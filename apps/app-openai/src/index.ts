import { formatTime, UUID } from '@yuants/data-model';
import { IResponse, Terminal } from '@yuants/protocol';
import { defer } from 'rxjs';

const terminal = new Terminal(process.env.HOST_URL!, {
  terminal_id: process.env.TERMINAL_ID || `app-openai/${UUID()}`,
  name: '@yuants/app-openai',
});

if (!process.env.OPENAI_API_KEY) {
  console.error('OPENAI_API_KEY is required');
  process.exit(1);
}

const availableModels = process.env.MODELS?.split(',');

if (!availableModels || availableModels.length === 0) {
  console.error('MODELS is required');
  process.exit(1);
}

declare module '@yuants/protocol' {
  interface IService {
    ChatWithAI: {
      req: {
        model: string;
        messages: { role: string; content: string }[];
      };
      frame: {
        content: string;
      };
      res: IResponse<{
        content: string;
      }>;
    };
  }
}
terminal.provideService(
  'ChatWithAI',
  {
    required: ['model', 'messages'],
    properties: {
      model: {
        type: 'string',
        enum: availableModels,
      },
    },
  },
  async function* (msg) {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY!}`,
      },
      body: JSON.stringify({
        model: msg.req.model,
        messages: msg.req.messages,
        stream: true,
      }),
    });
    if (res.status !== 200) {
      return { res: { code: res.status, message: res.statusText } };
    }

    const reader = res.body!.getReader();
    const decoder = new TextDecoder('utf-8');
    let theContent = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      // 解码流数据
      const chunk = decoder.decode(value);
      const lines = chunk.split('\n').filter((line) => line.trim() !== '');

      for (const line of lines) {
        console.info(formatTime(Date.now()), 'Received:', line);
        const message = line.replace(/^data: /, '');
        if (message === '[DONE]') {
          break;
        }

        try {
          const parsed = JSON.parse(message);
          const content = parsed.choices[0].delta.content;
          if (content) {
            theContent += content;
            yield { frame: { content } };
          }
        } catch (error) {
          console.error(formatTime(Date.now()), 'Error parsing message:', error);
        }
      }
    }
    yield { res: { code: 0, message: 'OK', data: { content: theContent } } };
  },
);

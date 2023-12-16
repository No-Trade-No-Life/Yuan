import { Typography } from '@douyinfe/semi-ui';
import { IMessageCardProps } from '../model';

export default ({ payload }: IMessageCardProps<{ text: string }>) => {
  const youtube_url_matched = /youtube\.com\/watch\?v=(.+)/.exec(payload.text);
  return (
    <>
      <Typography.Title heading={3} style={{ width: '100%', flexShrink: 0 }}>
        {payload.text}
      </Typography.Title>
      {youtube_url_matched?.[1] && (
        <iframe
          width="560"
          height="315"
          src={`https://www.youtube.com/embed/${youtube_url_matched[1]}`}
          title="YouTube video player"
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        ></iframe>
      )}
    </>
  );
};

import { Button, Card, Form, Space, TextArea, Toast, Typography } from '@douyinfe/semi-ui';
import { createKeyPair, decryptByPrivateKey, encryptByPublicKey } from '@yuants/utils';
import { useRef, useState } from 'react';
import { registerPage } from '../Pages';

registerPage('CryptoTool', () => {
  const encryptFormRef = useRef<Form<any>>(null);
  const decryptFormRef = useRef<Form<any>>(null);
  const [encryptedData, setEncryptedData] = useState('');
  const [decryptedData, setDecryptedData] = useState('');
  const [tempKeyPair, setTempKeyPair] = useState<{ public_key: string; private_key: string } | null>(null);

  const handleGenerateKeyPair = () => {
    try {
      const keyPair = createKeyPair();
      setTempKeyPair(keyPair);
      Toast.success('临时密钥对生成成功');
    } catch (error) {
      console.error('生成密钥对失败:', error);
      Toast.error(`生成密钥对失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const handleEncrypt = async () => {
    try {
      const values = await encryptFormRef.current?.formApi.validate();
      if (!values) return;

      const publicKey = values.publicKey?.trim();
      const plaintext = values.plaintext;

      if (!publicKey) {
        Toast.error('请输入公钥');
        return;
      }
      if (!plaintext) {
        Toast.error('请输入明文');
        return;
      }

      // 将明文转换为 Uint8Array
      const encoder = new TextEncoder();
      const data = encoder.encode(plaintext);

      // 使用公钥加密
      const encrypted = encryptByPublicKey(data, publicKey);

      // 转换为 base64
      const base64 = btoa(String.fromCharCode(...encrypted));
      setEncryptedData(base64);

      Toast.success('加密成功');
    } catch (error) {
      console.error('加密失败:', error);
      Toast.error(`加密失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const handleDecrypt = async () => {
    try {
      const values = await decryptFormRef.current?.formApi.validate();
      if (!values) return;

      const privateKey = values.privateKey?.trim();
      const ciphertext = values.ciphertext?.trim();

      if (!privateKey) {
        Toast.error('请输入私钥');
        return;
      }
      if (!ciphertext) {
        Toast.error('请输入密文');
        return;
      }

      // 将 base64 转换为 Uint8Array
      const binaryString = atob(ciphertext);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // 使用私钥解密
      const decrypted = decryptByPrivateKey(bytes, privateKey);

      // 将 Uint8Array 转换为字符串
      const decoder = new TextDecoder();
      const plaintext = decoder.decode(decrypted);
      setDecryptedData(plaintext);

      Toast.success('解密成功');
    } catch (error) {
      console.error('解密失败:', error);
      Toast.error(`解密失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  return (
    <Space vertical style={{ padding: '24px', width: '100%' }}>
      <Typography.Title heading={3}>ED25519 加密/解密工具</Typography.Title>

      {/* 临时密钥对生成 */}
      <Card title="临时密钥对" style={{ width: '100%' }}>
        <Space vertical style={{ width: '100%' }}>
          <Button theme="solid" type="primary" onClick={handleGenerateKeyPair}>
            生成临时密钥对
          </Button>
          {tempKeyPair && (
            <>
              <div>
                <Typography.Text strong>公钥 (Base58):</Typography.Text>
                <TextArea
                  value={tempKeyPair.public_key}
                  autosize={{ minRows: 2, maxRows: 4 }}
                  style={{ marginTop: 8 }}
                  readOnly
                />
                <Space style={{ marginTop: 8 }}>
                  <Button
                    onClick={() => {
                      navigator.clipboard.writeText(tempKeyPair.public_key);
                      Toast.success('公钥已复制到剪贴板');
                    }}
                  >
                    复制公钥
                  </Button>
                  <Button
                    onClick={() => {
                      encryptFormRef.current?.formApi.setValue('publicKey', tempKeyPair.public_key);
                      Toast.success('公钥已填入加密表单');
                    }}
                  >
                    使用此公钥加密
                  </Button>
                </Space>
              </div>
              <div>
                <Typography.Text strong>私钥 (Base58):</Typography.Text>
                <TextArea
                  value={tempKeyPair.private_key}
                  autosize={{ minRows: 2, maxRows: 4 }}
                  style={{ marginTop: 8 }}
                  readOnly
                />
                <Space style={{ marginTop: 8 }}>
                  <Button
                    onClick={() => {
                      navigator.clipboard.writeText(tempKeyPair.private_key);
                      Toast.success('私钥已复制到剪贴板');
                    }}
                  >
                    复制私钥
                  </Button>
                  <Button
                    onClick={() => {
                      decryptFormRef.current?.formApi.setValue('privateKey', tempKeyPair.private_key);
                      Toast.success('私钥已填入解密表单');
                    }}
                  >
                    使用此私钥解密
                  </Button>
                </Space>
              </div>
            </>
          )}
        </Space>
      </Card>

      {/* 加密面板 */}
      <Card title="加密" style={{ width: '100%' }}>
        <Form ref={encryptFormRef} layout="vertical">
          <Form.Input
            field="publicKey"
            label="ED25519 公钥 (Base58)"
            placeholder="请输入 Base58 编码的 ED25519 公钥"
            style={{ width: '100%' }}
          />
          <Form.TextArea
            field="plaintext"
            label="明文"
            placeholder="请输入要加密的明文内容"
            autosize={{ minRows: 4, maxRows: 8 }}
            style={{ width: '100%' }}
          />
          <Space style={{ marginTop: 16 }}>
            <Button theme="solid" type="primary" onClick={handleEncrypt}>
              加密
            </Button>
            <Button
              onClick={() => {
                encryptFormRef.current?.formApi.reset();
                setEncryptedData('');
              }}
            >
              清空
            </Button>
          </Space>
          {encryptedData && (
            <div style={{ marginTop: 16 }}>
              <Typography.Text strong>密文 (Base64):</Typography.Text>
              <TextArea
                value={encryptedData}
                autosize={{ minRows: 4, maxRows: 8 }}
                style={{ marginTop: 8 }}
                readOnly
              />
              <Button
                style={{ marginTop: 8 }}
                onClick={() => {
                  navigator.clipboard.writeText(encryptedData);
                  Toast.success('已复制到剪贴板');
                }}
              >
                复制密文
              </Button>
            </div>
          )}
        </Form>
      </Card>

      {/* 解密面板 */}
      <Card title="解密" style={{ width: '100%' }}>
        <Form ref={decryptFormRef} layout="vertical">
          <Form.Input
            field="privateKey"
            label="ED25519 私钥 (Base58)"
            placeholder="请输入 Base58 编码的 ED25519 私钥"
            style={{ width: '100%' }}
          />
          <Form.TextArea
            field="ciphertext"
            label="密文 (Base64)"
            placeholder="请输入 Base64 编码的密文"
            autosize={{ minRows: 4, maxRows: 8 }}
            style={{ width: '100%' }}
          />
          <Space style={{ marginTop: 16 }}>
            <Button theme="solid" type="primary" onClick={handleDecrypt}>
              解密
            </Button>
            <Button
              onClick={() => {
                decryptFormRef.current?.formApi.reset();
                setDecryptedData('');
              }}
            >
              清空
            </Button>
          </Space>
          {decryptedData && (
            <div style={{ marginTop: 16 }}>
              <Typography.Text strong>明文:</Typography.Text>
              <TextArea
                value={decryptedData}
                autosize={{ minRows: 4, maxRows: 8 }}
                style={{ marginTop: 8 }}
                readOnly
              />
              <Button
                style={{ marginTop: 8 }}
                onClick={() => {
                  navigator.clipboard.writeText(decryptedData);
                  Toast.success('已复制到剪贴板');
                }}
              >
                复制明文
              </Button>
            </div>
          )}
        </Form>
      </Card>
    </Space>
  );
});

import { CSSProperties, ReactNode, useState } from 'react';

interface CopilotButtonProps {
  children: ReactNode;
  style?: CSSProperties;
  onClick?: () => void;
}

const CopilotButton: React.FC<CopilotButtonProps> = ({ children, style = {}, onClick }) => {
  const [isHovered, setIsHovered] = useState(false);

  const defaultStyle: CSSProperties = {
    border: '1px solid rgba(0,0,0,.1)',
    backgroundColor: isHovered ? '#ececf1' : 'var(--semi-color-bg-0)',
    borderRadius: '0.75rem',
    borderColor: 'rgba(0,0,0,.1)',
    margin: 0,
    whiteSpace: 'normal',
    cursor: 'pointer',
    transition: 'box-shadow 0.3s ease, transform 0.3s ease',
    boxShadow: isHovered ? '0 4px 8px rgba(0, 0, 0, 0.2)' : '0 2px 4px rgba(0, 0, 0, 0.1)',
    transform: isHovered ? 'scale(1.02)' : 'scale(1)',
    padding: '1rem',
    ...style,
  };

  return (
    <div
      style={defaultStyle}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onClick}
    >
      {children}
    </div>
  );
};

export default CopilotButton;

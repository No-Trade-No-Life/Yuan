// 定义形状类型
type ShapeType = 'circle' | 'triangle' | 'rect' | 'line' | 'arc';

// 定义壁纸配置接口
interface WallpaperConfig {
  canvasWidth: number;
  canvasHeight: number;
  shapeCount: number;
  minShapeSize: number;
  maxShapeSize: number;
  gridSpacing: number;
  globalAlpha: number;
}

class DynamicWallpaper {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private config: WallpaperConfig;
  private colorPalette: string[];

  constructor(canvas: HTMLCanvasElement = document.createElement('canvas')) {
    this.canvas = canvas;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Could not get canvas context');
    this.ctx = context;

    // 初始化配置
    this.config = {
      canvasWidth: window.innerWidth,
      canvasHeight: window.innerHeight,
      shapeCount: 50 + Math.floor(Math.random() * 100),
      minShapeSize: 10,
      maxShapeSize: 100,
      gridSpacing: 40,
      globalAlpha: 0.7,
    };

    // 柔和色调色板
    this.colorPalette = [
      '#FF9AA2',
      '#FFB7B2',
      '#FFDAC1',
      '#E2F0CB',
      '#B5EAD7',
      '#C7CEEA',
      '#B8E0D2',
      '#D6EADF',
      '#EAC4D5',
      '#F8C7CC',
      '#B1BCE6',
      '#E2CFC4',
      '#A2D2FF',
      '#CDB4DB',
      '#FFAFCC',
      '#A0C4FF',
      '#BDE0FE',
      '#FFC8DD',
    ];

    this.resizeCanvas();
    window.addEventListener('resize', this.handleResize.bind(this));
  }

  private handleResize(): void {
    this.config.canvasWidth = window.innerWidth;
    this.config.canvasHeight = window.innerHeight;
    this.resizeCanvas();
    this.generateWallpaper();
  }

  private resizeCanvas(): void {
    this.canvas.width = this.config.canvasWidth;
    this.canvas.height = this.config.canvasHeight;
  }

  private getRandomColor(): string {
    return this.colorPalette[Math.floor(Math.random() * this.colorPalette.length)];
  }

  private generateShapeType(): ShapeType {
    const shapes: ShapeType[] = ['circle', 'triangle', 'rect', 'line', 'arc'];
    return shapes[Math.floor(Math.random() * shapes.length)];
  }

  private drawShape(type: ShapeType, x: number, y: number, size: number, color: string): void {
    this.ctx.fillStyle = color;
    this.ctx.strokeStyle = color;
    this.ctx.globalAlpha = this.config.globalAlpha;
    this.ctx.lineWidth = 2;

    switch (type) {
      case 'circle':
        this.ctx.beginPath();
        this.ctx.arc(x, y, size, 0, Math.PI * 2);
        this.ctx.fill();
        break;
      case 'triangle':
        this.ctx.beginPath();
        this.ctx.moveTo(x, y - size);
        this.ctx.lineTo(x - size, y + size);
        this.ctx.lineTo(x + size, y + size);
        this.ctx.closePath();
        this.ctx.fill();
        break;
      case 'rect':
        this.ctx.fillRect(x - size / 2, y - size / 2, size, size);
        break;
      case 'line':
        this.ctx.beginPath();
        this.ctx.moveTo(x - size, y);
        this.ctx.lineTo(x + size, y);
        this.ctx.stroke();
        break;
      case 'arc':
        this.ctx.beginPath();
        this.ctx.arc(x, y, size, 0, Math.PI);
        this.ctx.stroke();
        break;
    }
  }

  private createGradient(): CanvasGradient {
    const gradient = this.ctx.createLinearGradient(0, 0, this.config.canvasWidth, this.config.canvasHeight);

    const color1 = this.getRandomColor();
    let color2 = this.getRandomColor();

    // 确保两种颜色不同
    while (color1 === color2) {
      color2 = this.getRandomColor();
    }

    gradient.addColorStop(0, color1);
    gradient.addColorStop(1, color2);

    return gradient;
  }

  public generateWallpaper(): void {
    // 清除画布
    this.ctx.clearRect(0, 0, this.config.canvasWidth, this.config.canvasHeight);

    // 绘制渐变背景
    const gradient = this.createGradient();
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, 0, this.config.canvasWidth, this.config.canvasHeight);

    // 绘制随机形状
    for (let i = 0; i < this.config.shapeCount; i++) {
      const x = Math.random() * this.config.canvasWidth;
      const y = Math.random() * this.config.canvasHeight;
      const size =
        this.config.minShapeSize + Math.random() * (this.config.maxShapeSize - this.config.minShapeSize);
      const color = this.getRandomColor();
      const shapeType = this.generateShapeType();

      this.drawShape(shapeType, x, y, size, color);
    }

    // 添加网格线
    this.ctx.globalAlpha = 0.1;
    this.ctx.strokeStyle = '#ffffff';
    this.ctx.lineWidth = 1;

    // 水平线
    for (let y = 0; y < this.config.canvasHeight; y += this.config.gridSpacing) {
      this.ctx.beginPath();
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(this.config.canvasWidth, y);
      this.ctx.stroke();
    }

    // 垂直线
    for (let x = 0; x < this.config.canvasWidth; x += this.config.gridSpacing) {
      this.ctx.beginPath();
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, this.config.canvasHeight);
      this.ctx.stroke();
    }

    this.ctx.globalAlpha = 1.0;
  }

  public generateImageDataUrl(quality: number = 0.8): Promise<string> {
    return new Promise((resolve) => {
      this.canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve('');
            return;
          }
          const reader = new FileReader();
          reader.onload = () => {
            resolve(reader.result as string);
          };
          reader.readAsDataURL(blob);
        },
        'image/jpeg',
        quality,
      );
    });
  }
}

export const generateWallpaper = () => {
  const wallpaper = new DynamicWallpaper();
  wallpaper.generateWallpaper();
  return wallpaper.generateImageDataUrl();
};

Object.assign(globalThis, { generateWallpaper });

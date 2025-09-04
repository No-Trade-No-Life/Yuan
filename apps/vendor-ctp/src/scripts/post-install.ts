import { execSync } from 'child_process';
import { arch } from 'os';

// 检测系统是否为Debian/Ubuntu

if (process.platform === 'linux') {
  if (arch() === 'x64') {
    console.log('Detected Linux x64 architecture.');
    // if is apt-get based system
    if (execSync('which apt || echo ""').toString().trim()) {
      console.log('Detected apt-get based system. Installing dependencies...');
      execSync('apt update && apt install -y libspdlog-dev libzmq3-dev', {
        stdio: 'inherit',
      });

      //   // Install cppzmq
      //   const installZmqDir = join(tmpdir(), 'ctp/cppzmq', UUID());
      //   console.info('Installing cppzmq in', installZmqDir);
      //   mkdirSync(installZmqDir, { recursive: true });
      //   execSync(
      //     `wget -O - https://github.com/zeromq/cppzmq/archive/refs/tags/v4.9.0.tar.gz | tar -zxv -C ${installZmqDir}`,
      //     { stdio: 'inherit' },
      //   );
      //   mkdirSync(join(installZmqDir, 'cppzmq-4.9.0', 'build'));
      //   execSync('cmake .. && make -j4 install', {
      //     cwd: join(installZmqDir, 'cppzmq-4.9.0', 'build'),
      //     stdio: 'inherit',
      //   });
      //   rmSync(installZmqDir, { recursive: true, force: true });
      //   console.log('cppzmq installed successfully.');

      //   // Build CTP (main_linux)
      //   console.log('Building CTP native addons...');
      //   const ctpBuildDir = join(__dirname, '../../ctp/build');
      //   rmSync(ctpBuildDir, { recursive: true, force: true });
      //   mkdirSync(ctpBuildDir, { recursive: true });
      //   execSync('cmake .. && make', { cwd: ctpBuildDir, stdio: 'inherit' });
      //   console.log('CTP native addons built successfully.');
      process.exit(0);
    }
  }
}
console.warn('Skipping CTP native addon installation. Unsupported platform.');

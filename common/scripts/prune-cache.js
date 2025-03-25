#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const readline = require('readline');

// 脚本用法：node script.js [--ci-run] <正则表达式> <目录路径>
// 示例：node script.js '^([a-z]+)_' /path/to/files
// 或者：node script.js --ci-run '^([a-z]+)_' /path/to/files

// 获取命令行参数
let args = process.argv.slice(2);
let ciMode = false;

// 检查是否有 --ci-run 参数
if (args.includes('--ci-run')) {
  ciMode = true;
  args = args.filter(arg => arg !== '--ci-run');
}

if (args.length !== 2) {
  console.error(`Usage: ${process.argv[1]} [--ci-run] <group_regex> <directory>`);
  process.exit(1);
}

const REGEX_STR = args[0];
const DIR = args[1];

// 验证目录存在
if (!fs.existsSync(DIR) || !fs.statSync(DIR).isDirectory()) {
  console.error(`Error: Directory ${DIR} does not exist`);
  process.exit(1);
}

// 创建正则表达式对象
const REGEX = new RegExp(REGEX_STR);

// 存储每个分组的最新文件
const LATEST_FILES = {};
// 存储要删除的文件
const TO_DELETE = [];

// 获取目录中的所有文件
const files = fs.readdirSync(DIR)
  .filter(file => fs.statSync(path.join(DIR, file)).isFile())
  .map(file => path.join(DIR, file));

// 遍历文件
files.forEach(file => {
  // 获取文件名（不含路径）
  const filename = path.basename(file);

  // 使用正则表达式提取分组
  const match = filename.match(REGEX);
  if (match) {
    // 获取第一个捕获组作为分组标识
    const group = match[0];

    // 获取文件创建时间（Unix时间戳，单位秒）
    const stats = fs.statSync(file);
    // 使用创建时间，如果不可用则使用修改时间
    const ctime = Math.floor(stats.birthtimeMs ? stats.birthtimeMs / 1000 : stats.mtimeMs / 1000);

    // 比较并记录最新文件
    if (!LATEST_FILES[group] || ctime > LATEST_FILES[group].ctime) {
      // 如果已有旧记录，先保存旧文件路径用于后续删除
      if (LATEST_FILES[group]) {
        const oldFile = LATEST_FILES[group].file;
        console.log(`Marking for deletion: ${oldFile}`);
        TO_DELETE.push(oldFile);
      }
      LATEST_FILES[group] = { ctime, file };
    } else {
      TO_DELETE.push(file);
    }
  }
});

// 删除所有非最新文件
if (TO_DELETE.length > 0) {
  console.log("The following files will be deleted:");
  TO_DELETE.forEach(file => console.log(file));

  // 如果是 CI 模式，则跳过确认直接删除
  if (ciMode) {
    console.log("Running in CI mode - deleting without confirmation");
    TO_DELETE.forEach(file => {
      try {
        fs.unlinkSync(file);
        console.log(`Deleted: ${file}`);
      } catch (err) {
        console.error(`Error deleting ${file}: ${err.message}`);
      }
    });

    // 显示保留的文件
    console.log("Latest files preserved:");
    Object.values(LATEST_FILES).forEach(item => {
      console.log(item.file);
    });
  } else {
    // 创建一个readline接口用于用户交互
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    rl.question("Confirm deletion? [y/N] ", (answer) => {
      if (answer.toLowerCase() === 'y') {
        TO_DELETE.forEach(file => {
          try {
            fs.unlinkSync(file);
            console.log(`Deleted: ${file}`);
          } catch (err) {
            console.error(`Error deleting ${file}: ${err.message}`);
          }
        });
      } else {
        console.log("Deletion cancelled");
      }

      // 显示保留的文件
      console.log("Latest files preserved:");
      Object.values(LATEST_FILES).forEach(item => {
        console.log(item.file);
      });

      rl.close();
    });
  }
} else {
  console.log("No files to delete");

  // 显示保留的文件
  console.log("Latest files preserved:");
  Object.values(LATEST_FILES).forEach(item => {
    console.log(item.file);
  });
}

import { randomBytes } from 'node:crypto';
import { existsSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const path = resolve('.env');
if (existsSync(path)) {
  console.log('Đã có .env; không ghi đè thông tin quản trị.');
  console.log('Muốn thiết lập lại, tự sao lưu/xóa file .env trước.');
  process.exit(0);
}
const adminPassword = randomBytes(12).toString('base64url');
const secret = randomBytes(48).toString('hex');
const config = `PORT=3000\nADMIN_PASSWORD=${adminPassword}\nSESSION_SECRET=${secret}\nDB_PATH=data/bookings.sqlite\n`;
writeFileSync(path, config, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
console.log('Đã tạo .env thành công.');
console.log(`Mật khẩu quản trị (hãy lưu ở nơi an toàn): ${adminPassword}`);
console.log('Vào http://localhost:3000/admin sau khi chạy "npm start".');
console.log('Không chia sẻ hoặc commit file .env và mật khẩu quản trị.');

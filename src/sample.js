// Dữ liệu mẫu để thử app (tất cả là dữ liệu giả)
const ago = (d, h = 0) => Date.now() - d * 86400000 - h * 3600000;
let n = 0; const id = () => 'demo' + Date.now().toString(36) + (n++);

export const sampleStickers = () => [
  { title: 'Việc hôm nay', color: 'y', items: [['Gửi file Spine cho team', 0], ['Sửa mesh tay nhân vật', 0], ['Xuất atlas 2048x2048', 1], ['Họp review 3h chiều', 1]] },
  { title: 'Đi chợ', color: 'm', items: [['Sữa tươi', 0], ['Trứng gà', 0], ['Rau cải', 0], ['Cà phê hạt', 1]] },
  { title: 'Ý tưởng concept', color: 'p', items: [['Rồng mây phong cách chibi', 0], ['Bảng màu hoàng hôn tím cam', 0], ['Thử brush mực tàu', 0]] },
  { title: 'Cocos 2.1.3', color: 'l', items: [['Test hiệu ứng confetti', 0], ['Đổi font số điểm', 1], ['Nén lại ảnh nền', 0]] },
  { title: 'Cuối tuần', color: 's', items: [['Dọn ổ D', 0], ['Backup project 3D', 0], ['Đi bơi', 1]] }
].map((s, i) => ({ id: id(), title: s.title, color: s.color, order: 100 - i, items: s.items.map(([text, done]) => ({ id: id(), text, done: !!done, doneAt: done ? ago(1) : 0 })) }));

export const sampleNotes = () => [
  { name: 'Spine 3.7.94', t: ago(0, 1), body: '<h4>Phím tắt hay dùng</h4><div><kbd>Space</kbd> phát / dừng · <kbd>Ctrl</kbd>+<kbd>E</kbd> xuất dữ liệu · giữ <kbd>Alt</kbd> kéo để nhân bản bone.</div><h4>Mẹo mesh</h4><div>Đặt vertex dọc theo khớp gối, khuỷu tay rồi mới bind weight. Dùng Weights → Auto rồi sửa tay chỗ vai.</div><h4>Xuất cho Cocos 2.1.3</h4><div>Chọn JSON, bỏ tick Nonessential data. Atlas: tắt Premultiply alpha để không bị viền đen.</div>' },
  { name: 'Cocos Creator 2.1.3', t: ago(1, 3), body: '<h4>Import Spine</h4><div>Kéo cả 3 file .json, .atlas, .png vào cùng một thư mục trong assets.</div><h4>Lỗi hay gặp</h4><div>Ảnh bị viền đen: tắt Premultiplied Alpha ở component sp.Skeleton.</div>' },
  { name: 'Blender', t: ago(5), body: '<h4>Retopo nhanh</h4><div>Bật Snap to Face + Shrinkwrap modifier.</div><h4>Phím tắt</h4><div><kbd>Ctrl</kbd>+<kbd>R</kbd> loop cut · <kbd>G</kbd> <kbd>G</kbd> trượt cạnh · <kbd>Shift</kbd>+<kbd>D</kbd> nhân bản.</div>' },
  { name: 'Photoshop', t: ago(9), body: '<h4>Tách layer cho Spine</h4><div>Dùng script LayersToPNG, đặt tên layer không dấu, không khoảng trắng.</div>' },
  { name: 'After Effects', t: ago(16), body: '<h4>Loop mượt</h4><div>Thêm expression loopOut("cycle") cho keyframe vị trí.</div>' }
].map((x, i) => ({ id: id(), name: x.name, body: x.body, order: i, editedAt: x.t }));

// Tab Đỏ: nhóm + tài khoản (giả)
export const sampleVault = () => {
  const g = [['Mạng xã hội', [
      ['Facebook cá nhân', [['Email', 'demo.mondiro@example.com'], ['Mật khẩu', 'Fb-Demo#2026', 1], ['2FA', 'Google Authenticator']]],
      ['Instagram', [['Tên', '@demo.artist'], ['Mật khẩu', 'Ig*Demo37', 1]]],
      ['Behance', [['Email', 'demo.mondiro@example.com'], ['Mật khẩu', 'Be-Demo!88', 1]]]]],
    ['Công việc', [
      ['Gmail công việc', [['Email', 'demo.work@example.com'], ['Mật khẩu', 'Work-Demo@1', 1], ['SĐT khôi phục', '0900 000 000']]],
      ['Spine license', [['Mã', 'DEMO-0000-1111-2222', 1], ['Email', 'demo.work@example.com']]]]],
    ['Ngân hàng', [['Ví điện tử (giả)', [['SĐT', '0900 000 000'], ['Mã PIN', '000000', 1]]]]],
    ['Game', [['Steam', [['Tên', 'demo_player'], ['Mật khẩu', 'Steam-Demo9', 1]]]]]];
  const out = [];
  g.forEach(([name, accs], gi) => {
    const gid = id(); out.push({ id: gid, kind: 'group', name: name + ' (mẫu)', order: 100 + gi });
    accs.forEach(([title, f], ai) => out.push({ id: id(), kind: 'acc', groupId: gid, title, order: ai, fields: f.map(([k, v, s]) => ({ k, v, secret: !!s })) }));
  });
  return out;
};

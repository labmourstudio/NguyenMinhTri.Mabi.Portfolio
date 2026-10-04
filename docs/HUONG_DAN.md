# Bắt đầu sử dụng Mabi Portfolio

Website có hai đường dẫn riêng. Khách xem mở trang chính. Bi mở đường dẫn có `#/editor` để đăng nhập và chỉnh sửa.

Tên ban đầu là **Nguyễn Minh Trí / Mabi**. Học vấn, kinh nghiệm, công cụ, sản phẩm và dự án được để trống để Bi tự điền. Các hình trang trí là đồ hoạ của giao diện, không phải sản phẩm mẫu.

## 1. Bật website trên GitHub Pages

Mở repo, chọn **Settings → Pages → Build and deployment → Source → GitHub Actions**.

Sau đó chọn **Actions → Deploy portfolio to Pages → Run workflow → main → Run workflow**. Chờ tác vụ chuyển sang màu xanh rồi mở link ở mục **Settings → Pages**.

Địa chỉ dự kiến của repo này là:

`https://labmourstudio.github.io/NguyenMinhTri.Mabi.Portfolio/`

Địa chỉ editor là:

`https://labmourstudio.github.io/NguyenMinhTri.Mabi.Portfolio/#/editor`

## 2. Tạo nơi lưu tài khoản và ảnh

Mở [Supabase](https://supabase.com/dashboard), đăng nhập, chọn **New project**, đặt tên **Mabi Portfolio** và chọn khu vực gần Việt Nam. Supabase sẽ yêu cầu một mật khẩu cơ sở dữ liệu; Bi tự tạo và giữ mật khẩu này.

Đợi dự án sẵn sàng. Mở **SQL Editor → New query**. Sao chép toàn bộ nội dung tệp [001_portfolio.sql](../supabase/migrations/001_portfolio.sql), dán vào SQL Editor rồi chọn **Run**. Đây là thao tác tạo kho dữ liệu và thiết lập quyền truy cập, chỉ làm một lần.

## 3. Tạo tài khoản của Bi

Trong Supabase, vào **Authentication → Users → Add user → Create new user**. Nhập email, tự đặt mật khẩu và bật **Auto Confirm User**. Không cần gửi mật khẩu cho người khác.

Trong cài đặt Authentication, tắt **Allow new users to sign up**. Portfolio không cần cho khách đăng ký tài khoản.

Quay lại SQL Editor, chạy đoạn dưới sau khi thay `EMAIL_CUA_BAN` bằng đúng email tài khoản vừa tạo:

```sql
insert into private.portfolio_owners (user_id)
select id from auth.users
where email = 'EMAIL_CUA_BAN'
on conflict do nothing;
```

Kiểm tra đã cấp quyền bằng đoạn sau. Kết quả phải có một dòng mang email của Bi:

```sql
select u.email
from private.portfolio_owners o
join auth.users u on u.id = o.user_id;
```

## 4. Kết nối website với kho dữ liệu

Trong Supabase, lấy **Project URL** ở phần kết nối dự án và **Publishable key** ở **Settings → API Keys**. Nếu dự án dùng khóa cũ thì dùng **anon / public key**. Hai thông tin này được phép dùng trong website. Không sử dụng **secret key** hoặc **service_role key**.

Mở trang `#/editor`. Khi chưa kết nối, trang sẽ hiện hướng dẫn và hai ô nhập. Điền Project URL và khóa công khai, chọn **Kiểm tra kết nối & tải cấu hình**.

Website sẽ tải về tệp `portfolio-config.json`. Mở repo GitHub, chọn **Add file → Upload files**, tải tệp này vào thư mục gốc để thay tệp cùng tên, rồi chọn **Commit changes**. GitHub Actions tự cập nhật website.

Website chỉ được kết nối trên mọi thiết bị sau khi tệp cấu hình đã được cập nhật trên GitHub. Cấu hình thử trong tab editor chỉ hỗ trợ kiểm tra lúc thiết lập; nó không thay cấu hình của link công khai.

## 5. Thêm nội dung

Trong **Thông tin cá nhân**, sửa tên, tiêu đề, giới thiệu và liên hệ. Chọn ảnh PNG/WebP có nền trong suốt để dùng làm ảnh cá nhân; chỉnh kích thước, vị trí, góc xoay và ánh sáng bằng các thanh điều chỉnh.

Trong **Ảnh & bố cục**, chọn nhóm đang chỉnh. Thêm ảnh/video, tiêu đề, văn bản hoặc nút liên kết. Bấm một ô để mở bảng chỉnh bên cạnh. Kéo nút **⠿** để đổi thứ tự; kéo góc dưới bên phải để đổi chiều rộng và chiều cao. Có các nút chuyển lên/xuống để sử dụng trên điện thoại hoặc bằng bàn phím.

Chiều rộng dùng lưới bốn cột trên máy tính. Bi có thể chọn ô 1, 2, 3 hoặc 4 cột. Chiều cao điều chỉnh riêng. Trên điện thoại, nội dung tự chuyển thành một cột để dễ đọc.

Trong **Kinh nghiệm**, **Công cụ**, **Học vấn** và **Dự án**, thêm thông tin thật của Bi. Dự án có ảnh bìa, vai trò, mô tả, link và trang nội dung riêng. Mỗi kinh nghiệm có thể gắn với một dự án liên quan.

Trong **Các mục trên trang**, đổi tên, ẩn, sắp xếp các mục hoặc thêm mục tự do. Trong **Màu sắc & hiệu ứng**, đổi bảng màu, chất kính, vùng sáng và tinh tú theo chuột.

## 6. Lưu, xem trước và chia sẻ

Các thay đổi được tự lưu vào bản nháp sau khoảng hai giây. Bi cũng có thể chọn **Lưu nháp**. Nếu mạng lỗi, trạng thái vẫn báo nội dung chưa lưu; giữ trang mở và thử lưu lại.

Chọn **Xem trước** để xem ở kích thước máy tính, máy tính bảng hoặc điện thoại. Bản nháp chỉ chủ sở hữu được đọc. Khách xem tiếp tục thấy phiên bản đã xuất bản trước đó.

Khi sẵn sàng, chọn **Xuất bản**. Ảnh/video được dùng sẽ được đưa sang kho công khai; nội dung công khai được cập nhật sau khi chuẩn bị tệp xong. Chọn **Sao chép link chia sẻ** để gửi địa chỉ website.

Chọn **Xuất bản HTML để gửi** để tải `Mabi-Portfolio.html`. Tệp chứa nội dung của **phiên bản đã xuất bản** cùng ảnh/video nhúng bên trong; người nhận có thể mở bằng trình duyệt mà không cần tài khoản hoặc kết nối Supabase. Các link đến website khác vẫn cần internet. Tệp này chỉ để xem, không có editor hay thông tin đăng nhập.

## 7. Gỡ ảnh và xoá tệp

**Gỡ ô** hoặc **Gỡ khỏi trang** chỉ bỏ ảnh khỏi bố cục. Tệp vẫn ở thư viện.

**Thư viện ảnh / video → Quản lý tệp → Xoá vĩnh viễn** xoá tệp. Hệ thống chặn xoá nếu tệp còn được dùng trong bản nháp hoặc bản đã xuất bản. Gỡ khỏi tất cả vị trí, xuất bản lại rồi mới xoá.

**Thay tệp** giữ nguyên vị trí các ô đang dùng ảnh. Thay đổi chỉ xuất hiện trong bản nháp; người ngoài vẫn thấy ảnh cũ cho đến lần xuất bản tiếp theo.

**Tải bản sao nội dung** tải cấu trúc chữ và bố cục dưới dạng JSON để giữ lại khi cần. Tệp JSON này không kèm các tệp ảnh/video; dùng xuất HTML khi cần bản xem có ảnh.

## 8. Khi cần kiểm tra

Nếu không đăng nhập được, kiểm tra tài khoản trong Supabase và bước cấp quyền chủ sở hữu. Nếu quên mật khẩu, đổi mật khẩu tài khoản qua phần quản trị Authentication của Supabase.

Nếu editor báo có bản nháp mới ở cửa sổ khác, tải bản sao nội dung hiện tại để giữ lại thay đổi, rồi chọn **Tải bản nháp mới**. Hệ thống không ghi đè âm thầm lên nội dung ở cửa sổ khác.

Nếu website chưa hiện nội dung mới, kiểm tra đã chọn **Xuất bản**, tệp `portfolio-config.json` trên GitHub đã có thông tin đúng và tác vụ GitHub Actions đã chạy thành công.

Ảnh hỗ trợ PNG, JPG, WebP, AVIF, GIF, tối đa 15 MB/tệp. Video hỗ trợ MP4 và WebM, tối đa 40 MB/tệp. Giới hạn tổng dung lượng phụ thuộc gói dịch vụ Supabase của Bi.

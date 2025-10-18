const http = require('http');

const CONFIG = {
  bridgePort: 9100,
  printerIP: '192.168.1.250',
  printerPort: 9100,
};

// Nội dung test tiếng Việt
const testContent = `Test Base64 Encoding:
Nguyễn Văn Tuấn Viên
Phạm Tường Viên
Thị Kênh Vương Trọng Cung Chanel
Sức mạn Trọng Cung Mận
150,000 VNĐ
áàảãạ ăằắẳẵặ âầấẩẫậ
đ éèẻẽẹ êềếểễệ
ôồốổỗộ ơờớởỡợ
ưừứửữự ýỳỷỹỵ`;

// Encode Base64 (giống frontend)
function encodeBase64(str) {
  return Buffer.from(str, 'utf8').toString('base64');
}

async function testBase64Print() {
  const contentBase64 = encodeBase64(testContent);
  
  console.log('📦 Original content:');
  console.log(testContent);
  console.log('\n📦 Base64 encoded:');
  console.log(contentBase64);
  
  const data = {
    ipAddress: CONFIG.printerIP,
    port: CONFIG.printerPort,
    contentBase64: contentBase64,  // Gửi Base64
    options: {
      mode: 'cp1258',
      align: 'center',
      feeds: 3
    }
  };

  const options = {
    hostname: 'localhost',
    port: CONFIG.bridgePort,
    path: '/print',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=UTF-8',
      'Content-Length': Buffer.byteLength(JSON.stringify(data))
    }
  };

  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          resolve(body);
        }
      });
    });

    req.on('error', reject);
    req.write(JSON.stringify(data));
    req.end();
  });
}

console.log('🖨️  Testing Base64 encoding method...\n');
testBase64Print()
  .then(result => {
    console.log('\n📊 Kết quả:', JSON.stringify(result, null, 2));
    if (result.success) {
      console.log('\n✅ In thành công! Kiểm tra giấy in:');
      console.log('   - Có thấy dấu tiếng Việt đúng không?');
      console.log('   - Nếu VẪN bị lỗi → Máy in không hỗ trợ CP1258 ở hardware');
    } else {
      console.log('\n❌ In thất bại:', result.error);
    }
  })
  .catch(error => {
    console.error('❌ Lỗi:', error.message);
  });

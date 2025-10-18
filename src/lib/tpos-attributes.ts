// TPOS Attributes from TPOS system - Shared across components
export const TPOS_ATTRIBUTES = {
  sizeText: [
    { Id: 5, Name: "Free Size" },
    { Id: 1, Name: "S" },
    { Id: 2, Name: "M" },
    { Id: 3, Name: "L" },
    { Id: 4, Name: "XL" },
    { Id: 31, Name: "XXL" },
    { Id: 32, Name: "XXXL" }
  ],
  sizeNumber: [
    { Id: 80, Name: "27" }, { Id: 81, Name: "28" }, { Id: 18, Name: "29" }, { Id: 19, Name: "30" },
    { Id: 20, Name: "31" }, { Id: 21, Name: "32" }, { Id: 46, Name: "34" }, { Id: 33, Name: "35" },
    { Id: 34, Name: "36" }, { Id: 35, Name: "37" }, { Id: 36, Name: "38" }, { Id: 37, Name: "39" },
    { Id: 44, Name: "40" }, { Id: 91, Name: "41" }, { Id: 92, Name: "42" }, { Id: 93, Name: "43" },
    { Id: 94, Name: "44" }, { Id: 22, Name: "1" }, { Id: 23, Name: "2" }, { Id: 24, Name: "3" },
    { Id: 48, Name: "4" }
  ],
  color: [
    { Id: 6, Name: "Trắng" }, { Id: 7, Name: "Đen" }, { Id: 8, Name: "Đỏ" }, { Id: 9, Name: "Vàng" },
    { Id: 10, Name: "Cam" }, { Id: 11, Name: "Xám" }, { Id: 12, Name: "Hồng" }, { Id: 14, Name: "Nude" },
    { Id: 15, Name: "Nâu" }, { Id: 16, Name: "Rêu" }, { Id: 17, Name: "Xanh" }, { Id: 25, Name: "Bạc" },
    { Id: 26, Name: "Tím" }, { Id: 27, Name: "Xanh Min" }, { Id: 28, Name: "Trắng Kem" }, { Id: 29, Name: "Xanh Lá" },
    { Id: 38, Name: "Cổ Vịt" }, { Id: 40, Name: "Xanh Đậu" }, { Id: 42, Name: "Tím Môn" }, { Id: 43, Name: "Muối Tiêu" },
    { Id: 45, Name: "Kem" }, { Id: 47, Name: "Hồng Đậm" }, { Id: 49, Name: "Ghi" }, { Id: 50, Name: "Xanh Mạ" },
    { Id: 51, Name: "Vàng Đồng" }, { Id: 52, Name: "Xanh Bơ" }, { Id: 53, Name: "Xanh Đen" }, { Id: 54, Name: "Xanh CoBan" },
    { Id: 55, Name: "Xám Đậm" }, { Id: 56, Name: "Xám Nhạt" }, { Id: 57, Name: "Xanh Dương" }, { Id: 58, Name: "Cam Sữa" },
    { Id: 59, Name: "Hồng Nhạt" }, { Id: 60, Name: "Đậm" }, { Id: 61, Name: "Nhạt" }, { Id: 62, Name: "Xám Khói" },
    { Id: 63, Name: "Xám Chuột" }, { Id: 64, Name: "Xám Đen" }, { Id: 65, Name: "Xám Trắng" }, { Id: 66, Name: "Xanh Đậm" },
    { Id: 67, Name: "Sọc Đen" }, { Id: 68, Name: "Sọc Trắng" }, { Id: 69, Name: "Sọc Xám" }, { Id: 70, Name: "Jean Trắng" },
    { Id: 71, Name: "Jean Xanh" }, { Id: 72, Name: "Cam Đất" }, { Id: 73, Name: "Nâu Đậm" }, { Id: 74, Name: "Nâu Nhạt" },
    { Id: 75, Name: "Đỏ Tươi" }, { Id: 76, Name: "Đen Vàng" }, { Id: 77, Name: "Cà Phê" }, { Id: 78, Name: "Đen Bạc" },
    { Id: 79, Name: "Bò" }, { Id: 82, Name: "Sọc Xanh" }, { Id: 83, Name: "Xanh Rêu" }, { Id: 84, Name: "Hồng Ruốc" },
    { Id: 85, Name: "Hồng Dâu" }, { Id: 86, Name: "Xanh Nhạt" }, { Id: 87, Name: "Xanh Ngọc" }, { Id: 88, Name: "Caro" },
    { Id: 89, Name: "Sọc Hồng" }, { Id: 90, Name: "Trong" }, { Id: 95, Name: "Trắng Hồng" }, { Id: 96, Name: "Trắng Sáng" },
    { Id: 97, Name: "Đỏ Đô" }, { Id: 98, Name: "Cam Đào" }, { Id: 99, Name: "Cam Lạnh" }, { Id: 100, Name: "Hồng Đào" },
    { Id: 101, Name: "Hồng Đất" }, { Id: 102, Name: "Tím Đậm" }
  ]
};

export const DEFAULT_SELECTIONS = {
  sizeText: ["M", "L", "XL", "XXL", "XXXL"],
  color: ["Cam", "Xanh Đậu", "Xanh Đen"],
  sizeNumber: ["29", "30", "32"]
};

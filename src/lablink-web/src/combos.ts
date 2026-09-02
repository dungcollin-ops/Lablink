/** Combo xét nghiệm dựng sẵn — mỗi combo là danh sách từ khoá tìm;
 * khi bấm sẽ thêm xét nghiệm khớp đầu tiên cho từng từ khoá (README · applyCombo). */
export interface Combo {
  name: string;
  queries: string[];
}

export const COMBOS: Combo[] = [
  {
    name: "Khám sức khỏe tổng quát",
    queries: ["CBC", "Glucose FPG", "Cholesterol total", "Triglyceride", "Ure", "Creatinin", "SGOT", "SGPT"],
  },
  {
    name: "Tầm soát tiểu đường",
    queries: ["Glucose FPG", "HbA1c", "Insulin"],
  },
  {
    name: "Xét nghiệm tiền phẫu",
    queries: ["CBC", "PT", "APTT", "Glucose FPG", "HBsAg", "HIV"],
  },
];

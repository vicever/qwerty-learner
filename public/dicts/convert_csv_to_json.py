import csv
import json

# 输入和输出文件路径
csv_file_path = './单词72-101-Sheet3.csv'
json_file_path = './Dongchang_High_School_English_Sheet3.json'

# 读取 CSV 文件并转换为 JSON 格式
def csv_to_json(csv_path, json_path):
    json_data = []
    
    with open(csv_path, mode='r', encoding='utf-8-sig') as csv_file:
        # 使用 csv.reader 读取文件，指定分隔符为逗号
        csv_reader = csv.reader(csv_file)
        
        # 跳过前两行（标题行和空行）
        next(csv_reader)  # 跳过第一行（可能是标题行）
        next(csv_reader)  # 跳过第二行（可能是空行或列名行）
        
        for row in csv_reader:
            # 确保行不为空且有足够的列
            if len(row) >= 3:
                english = row[1].strip()  # 第二列是“英文”
                chinese = row[2].strip()  # 第三列是“中文释义”
                
                if english and chinese:  # 确保内容非空
                    json_data.append({
                        "name": english,
                        "trans": [chinese]
                    })
    
    # 保存为 JSON 文件
    with open(json_path, mode='w', encoding='utf-8') as json_file:
        json.dump(json_data, json_file, ensure_ascii=False, indent=2)

# 执行转换
csv_to_json(csv_file_path, json_file_path)
print(f"转换完成，JSON 文件已保存到: {json_file_path}")

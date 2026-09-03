import pandas as pd
from pathlib import Path

# =========================
# 配置
# =========================

INPUT_FILE = "bus_stations.xlsx"
OUTPUT_FILE = "stations.txt"


# =========================
# 读取 Excel
# =========================

print("正在读取 Excel……")

df = pd.read_excel(
    INPUT_FILE,
    header=1,      # 把第一行当标题
    dtype=str         # 全部按照文字读取
)

print(f"Excel 尺寸：{df.shape[0]} 行 × {df.shape[1]} 列")


# =========================
# 合并所有单元格
# =========================

stations = []

for column in df.columns:
    for value in df[column]:

        # 跳过空单元格
        if pd.isna(value):
            continue

        value = str(value).strip()

        # 跳过空字符串
        if not value:
            continue

        stations.append(value)


print(f"原始站名数量：{len(stations)}")


# =========================
# 全局去重
# 保留第一次出现的站名
# =========================

unique_stations = list(dict.fromkeys(stations))


print(f"去重后站名数量：{len(unique_stations)}")
print(f"删除重复数量：{len(stations) - len(unique_stations)}")


# =========================
# 写入 TXT
# UTF-8 编码
# =========================

with open(
    OUTPUT_FILE,
    "w",
    encoding="utf-8",
    newline="\n"
) as f:

    for station in unique_stations:
        f.write(station + "\n")


# =========================
# 完成
# =========================

print()
print("处理完成！")
print(f"输出文件：{Path(OUTPUT_FILE).resolve()}")
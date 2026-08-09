import json, re
p = r"E:\辽河实验室\网站建设\北大网站建设\北大实验室网站部署_WorkBuddy\site\content\site.json"
with open(p, 'r', encoding='utf-8') as f:
    data = json.load(f)

def clean(s):
    if not isinstance(s, str): return s
    s = s.replace('北京大学北京大学物理智能实验室', '北京大学物理智能实验室')
    # normalize repeated PKU
    s = re.sub(r'PKU\s+PKU\s+Physical Intelligence Lab', 'PKU Physical Intelligence Lab', s)
    return s

def walk(obj):
    if isinstance(obj, str):
        return clean(obj)
    elif isinstance(obj, list):
        return [walk(x) for x in obj]
    elif isinstance(obj, dict):
        return {k: walk(v) for k, v in obj.items()}
    return obj

data = walk(data)

# Make footer name fields clean and bilingual via spanPair in build.js
data['footer']['name_en'] = 'PKU Physical Intelligence Lab'
data['footer']['name_zh'] = '北京大学物理智能实验室'

# Clean bio intro English: remove embedded Chinese parentheses in English field
bio_en = data['bio'][0]['en']
bio_en = re.sub(r'\s*\(北京大学物理智能实验室\)', '', bio_en)
bio_en = re.sub(r'PKU\s+Physical Intelligence Lab', 'PKU Physical Intelligence Lab', bio_en)
data['bio'][0]['en'] = bio_en

with open(p, 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)
    f.write('\n')
print('cleaned')

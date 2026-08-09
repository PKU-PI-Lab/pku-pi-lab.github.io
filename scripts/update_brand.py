import json, re
p = r"E:\辽河实验室\网站建设\北大网站建设\北大实验室网站部署_WorkBuddy\site\content\site.json"
with open(p, 'r', encoding='utf-8') as f:
    data = json.load(f)

def replace_in(obj):
    if isinstance(obj, str):
        s = obj
        # English: don't add a second PKU prefix
        s = re.sub(r'(?<!PKU\s)(?<!PKU)Physical Intelligence Lab', 'PKU Physical Intelligence Lab', s)
        # Chinese: don't prepend 北京大学 if it's already there
        s = re.sub(r'(?<!北京大学)物理智能实验室', '北京大学物理智能实验室', s)
        return s
    elif isinstance(obj, list):
        return [replace_in(x) for x in obj]
    elif isinstance(obj, dict):
        return {k: replace_in(v) for k, v in obj.items()}
    return obj

# Explicit cleanups for fields that previously carried embedded Chinese parentheses
data['home']['affiliation_en'] = 'School of Advanced Manufacturing and Robotics<br>Director, PKU Physical Intelligence Lab'
data['home']['affiliation_zh'] = '北京大学先进制造与机器人学院<br>北京大学物理智能实验室主任'

data = replace_in(data)

# Specific summer-internship news wording (different from the generic pattern)
for item in data['news']['items']:
    item['en'] = re.sub(r'Peking University Industrial Embodied Intelligence Lab summer internship program',
                        'PKU Physical Intelligence Lab summer internship program', item['en'])
    item['zh'] = re.sub(r'北京大学工业具身智能实验室暑期实习招聘',
                        '北京大学物理智能实验室暑期实习招聘', item['zh'])

with open(p, 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)
    f.write('\n')
print('updated')

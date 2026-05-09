import sys

input_file = 'postgres.dump'
with open(input_file, 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_lines = []
for line in lines:
    if line.strip().startswith('ALTER DEFAULT PRIVILEGES'):
        new_lines.append('-- ' + line)
    else:
        new_lines.append(line)

with open(input_file, 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

print("ALTER DEFAULT PRIVILEGES removed.")

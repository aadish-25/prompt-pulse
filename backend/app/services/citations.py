import re


def extract_cited(answer: str) -> set[int]:
    cited: set[int] = set()

    # closing line: "CITED: 1, 7, 8" or legacy "Sources used: 1, 7, 8"
    for m in re.findall(r"(?:CITED|Sources used):[ \t]*([\d, ]+)", answer, flags=re.I):
        cited.update(int(n) for n in re.findall(r"\d+", m))

    # inline: [1]  [1][3]  [1, 3]
    for group in re.findall(r"\[([\d,\s]+)\]", answer):
        cited.update(int(n) for n in re.findall(r"\d+", group))

    # the model's own style: 【7】 and 【7†L1-L4】
    cited.update(int(n) for n in re.findall(r"【(\d+)", answer))

    return cited

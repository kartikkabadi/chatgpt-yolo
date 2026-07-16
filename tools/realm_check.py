from pathlib import Path
p=Path('portability.js')
s=p.read_text()
a='''  function plainObject(value) {\n    if (!value || typeof value !== "object" || Array.isArray(value)) return false;\n    const prototype = Object.getPrototypeOf(value);\n    return prototype === Object.prototype || prototype === null;\n  }'''
b='''  function plainObject(value) {\n    return Boolean(value)\n      && typeof value === "object"\n      && !Array.isArray(value)\n      && Object.prototype.toString.call(value) === "[object Object]";\n  }'''
assert s.count(a)==1
p.write_text(s.replace(a,b,1))

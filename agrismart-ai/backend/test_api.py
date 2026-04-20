import urllib.request, urllib.error
try:
    req = urllib.request.Request('https://krishimitra-4rqt.onrender.com/api/v1/chat', method='POST', data=b'{"message": "hi", "history": [], "language": "en"}', headers={'Content-Type': 'application/json', 'Origin': 'https://krishimitra-nine-wine.vercel.app'})
    print(urllib.request.urlopen(req).read().decode())
except urllib.error.HTTPError as e:
    print(e.code)
    print(e.read().decode())



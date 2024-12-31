# fsk-endurance

https://fsk-endurance.luftaquila.io

Formula Student Korea 2023 Endurance Race telemetry data viewer.

Team A-FA, Ajou University.

## Run locally

```sh
git clone https://github.com/luftaquila/fsk-endurance.git --recursive
cd fsk-endurance
python -m http.server 80
```

Open [http://localhost](http://localhost)

## Python data manipulation

### Prerequisites

```sh
pip install requests msgpack
```

### Run

```py
import os
import json
import msgpack
import requests

def load():
    if os.path.isfile("data.msgpack"):
        print("Local dataset found!")
        with open("data.msgpack", "rb") as f:
            data = f.read()
    else:
        print("Downloading dataset...")
        response = requests.get("https://github.com/luftaquila/fsk-endurance/raw/refs/heads/main/data.msgpack")
        data = response.content
        with open("data.msgpack", "wb") as f:
            f.write(data)

    print("Parsing dataset...")
    return msgpack.unpackb(data, raw=False)

data = load()

print(f"example data[500] out of total {len(data)} data:")
print(json.dumps(data[500], indent=2))
print("Log format from https://github.com/luftaquila/a-fa-telemetry/blob/master/web/review/types.js")
```

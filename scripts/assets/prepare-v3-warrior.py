"""Package the free CC0 Quaternius base + selected animations; raw ZIPs stay in art-source.
Run: python3 scripts/assets/prepare-v3-warrior.py
No paid assets, external dependency or texture modification is required.
"""
from pathlib import Path
import copy
import json
import struct

SOURCE = Path('art-source/v3-warriors/source')
base_dir = SOURCE / 'Universal Base Characters[Standard]/Base Characters/Godot - UE'
doc = json.loads((base_dir / 'Superhero_Male_FullBody.gltf').read_text())
blobs = [(base_dir / b['uri']).read_bytes() for b in doc['buffers']]
# Retain authored colour textures. Uniform roughness avoids shipping three 4K maps.
for index, material in enumerate(doc['materials']):
    if index == 0:
        material['pbrMetallicRoughness'].pop('baseColorTexture', None)
        material['pbrMetallicRoughness']['baseColorFactor'] = [.055, .035, .025, 1]
    material.pop('normalTexture', None)
    material['pbrMetallicRoughness'].pop('metallicRoughnessTexture', None)
    material['pbrMetallicRoughness']['roughnessFactor'] = .82
for mesh in doc['meshes']:
    for primitive in mesh['primitives']:
        primitive['attributes'] = {k: v for k, v in primitive['attributes'].items() if k in ['POSITION', 'NORMAL', 'TEXCOORD_0', 'JOINTS_0', 'WEIGHTS_0']}
clips = {
    'UAL1_Standard.glb': ['Idle_Loop', 'Sword_Idle', 'Walk_Loop', 'Jog_Fwd_Loop', 'Sprint_Loop', 'Sword_Attack', 'Punch_Cross', 'Hit_Chest', 'Death01', 'Roll'],
    'UAL2_Standard.glb': ['Sword_Regular_A', 'Sword_Regular_A_Rec', 'Sword_Regular_B', 'Sword_Regular_B_Rec', 'Sword_Regular_C', 'Sword_Block', 'Hit_Knockback'],
}
names = {n['name']: i for i, n in enumerate(doc['nodes'])}
doc['animations'] = []
for filename, selected in clips.items():
    path = next(SOURCE.rglob(filename)); raw = path.read_bytes()
    length = struct.unpack_from('<I', raw, 12)[0]
    src = json.loads(raw[20:20+length]); binary = raw[28+length:]
    blob_id = len(blobs); blobs.append(binary)
    view_offset, accessor_offset = len(doc['bufferViews']), len(doc['accessors'])
    for view in src['bufferViews']:
        view = copy.deepcopy(view); view['buffer'] = blob_id; doc['bufferViews'].append(view)
    for accessor in src['accessors']:
        accessor = copy.deepcopy(accessor); accessor['bufferView'] += view_offset; doc['accessors'].append(accessor)
    for animation in src['animations']:
        if animation['name'] not in selected: continue
        animation = copy.deepcopy(animation)
        channels = []
        for channel in animation['channels']:
            target = channel['target']; name = src['nodes'][target['node']]['name']
            # Keep target character proportions, with authored hip/root movement.
            if target['path'] == 'scale' or (target['path'] == 'translation' and name not in ['root', 'pelvis']): continue
            target['node'] = names[name]; channels.append(channel)
        animation['channels'] = channels
        used = sorted({c['sampler'] for c in channels}); remap = {old: new for new, old in enumerate(used)}
        animation['samplers'] = [animation['samplers'][i] for i in used]
        for sampler in animation['samplers']:
            sampler['input'] += accessor_offset; sampler['output'] += accessor_offset
        for channel in channels: channel['sampler'] = remap[channel['sampler']]
        doc['animations'].append(animation)
# Compact accessors and their buffer views instead of shipping the unused libraries.
refs = []
for mesh in doc['meshes']:
    for p in mesh['primitives']:
        refs += [(p, 'indices')] + [(p['attributes'], k) for k in p['attributes']]
for skin in doc['skins']: refs.append((skin, 'inverseBindMatrices'))
for animation in doc['animations']:
    for s in animation['samplers']: refs += [(s, 'input'), (s, 'output')]
used = sorted({obj[key] for obj, key in refs}); remap = {old: new for new, old in enumerate(used)}
doc['accessors'] = [doc['accessors'][i] for i in used]
for obj, key in refs: obj[key] = remap[obj[key]]
views, packed = [], bytearray()
def append(data):
    while len(packed) % 4: packed.append(0)
    offset = len(packed); packed.extend(data); return offset
for a in doc['accessors']:
    v = doc['bufferViews'][a['bufferView']]
    # Accessors with the same view reuse its data.
    if '_new' not in v:
        offset = v.get('byteOffset', 0); data = blobs[v['buffer']][offset:offset+v['byteLength']]
        new = {k: val for k, val in v.items() if k not in ['buffer', 'byteOffset', '_new']}
        new.update(buffer=0, byteOffset=append(data)); v['_new'] = len(views); views.append(new)
    a['bufferView'] = v['_new']
textures, images = [], []
for material in doc['materials']:
    texture_info = material['pbrMetallicRoughness'].get('baseColorTexture')
    if not texture_info: continue
    texture = doc['textures'][texture_info['index']]; image = doc['images'][texture['source']]
    data = (base_dir / image['uri']).read_bytes()
    images.append({'mimeType': 'image/png', 'bufferView': len(views)})
    views.append({'buffer': 0, 'byteOffset': append(data), 'byteLength': len(data)})
    textures.append({'source': len(images)-1, **({'sampler': texture['sampler']} if 'sampler' in texture else {})})
    texture_info['index'] = len(textures)-1
while len(packed) % 4: packed.append(0)
doc['bufferViews'] = views; doc['buffers'] = [{'byteLength': len(packed)}]
doc['textures'] = textures; doc['images'] = images
payload = json.dumps(doc, separators=(',', ':')).encode(); payload += b' ' * ((-len(payload)) % 4)
output = struct.pack('<III', 0x46546c67, 2, 28+len(payload)+len(packed)) + struct.pack('<II', len(payload), 0x4e4f534a) + payload + struct.pack('<II', len(packed), 0x004e4942) + packed
target = Path('public/arts/v3-models/warrior-base.glb'); target.write_bytes(output)
print(target, len(output), 'bytes;', len(doc['animations']), 'authored clips')

# HDI Mac

Package for handling hard disk images on macOS

[![npm](https://img.shields.io/npm/v/@shockpkg/hdi-mac.svg)](https://npmjs.com/package/@shockpkg/hdi-mac)
[![node](https://img.shields.io/node/v/@shockpkg/hdi-mac.svg)](https://nodejs.org)

[![size](https://packagephobia.now.sh/badge?p=@shockpkg/hdi-mac)](https://packagephobia.now.sh/result?p=@shockpkg/hdi-mac)
[![downloads](https://img.shields.io/npm/dm/@shockpkg/hdi-mac.svg)](https://npmcharts.com/compare/@shockpkg/hdi-mac?minimal=true)

[![main](https://github.com/shockpkg/hdi-mac/actions/workflows/main.yaml/badge.svg)](https://github.com/shockpkg/hdi-mac/actions/workflows/main.yaml)

# Overview

A simple hdiutil wrapper for handling hard disk images in macOS.

Only those features required to work with shockpkg packages are implemented.

Currently mounting and ejecting disk images is supported.

Fully wrapping all available hdiutil features is out of scope for this project.

Only functions on macOS as it depends on the macOS hdiutil, but safe to import or require on all platforms.

# Usage

## Basic Usage

```js
import {Mounter} from '@shockpkg/hdi-mac';

const mounter = new Mounter();
const {devices, eject} = await mounter.attach('path/to/diskimage.dmg');
console.log(devices);
await eject();
```

# Bugs

If you find a bug or have compatibility issues, please open a ticket under issues section for this repository.

# License

Copyright (c) 2019-2024 JrMasterModelBuilder

Licensed under the Mozilla Public License, v. 2.0.

If this license does not work for you, feel free to contact me.

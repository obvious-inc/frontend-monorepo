// Required to make dependencies that depend on buffer work (farcaster stuff)

import { Buffer } from "buffer";
window.Buffer = Buffer;

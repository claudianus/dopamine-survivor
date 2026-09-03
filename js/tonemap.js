'use strict';
/* ============================================================
 * 도파민 서바이버 - WebGL 톤맵핑 합성 패스
 * 씬(LDR) + 블룸(HDR 근사)을 float로 합산한 뒤
 * Khronos PBR Neutral 톤매퍼로 하이라이트 롤오프.
 * 후반부 무기 만렙/러시에서 화면이 하얗게 날아가는
 * '가산 클램핑 붕괴'를 근본적으로 해결한다.
 *
 * Khronos PBR Neutral (c) Khronos Group — Apache-2.0
 * https://github.com/KhronosGroup/ToneMapping
 * ============================================================ */

const TONEMAP = {
  gl: null, prog: null, quad: null, tex: null,
  enabled: false,

  VERT: `
    attribute vec2 aPos;
    varying vec2 vUV;
    void main() {
      vUV = aPos * 0.5 + 0.5;
      gl_Position = vec4(aPos, 0.0, 1.0);
    }
  `,

  FRAG: `
    precision mediump float;
    varying vec2 vUV;
    uniform sampler2D uScene;   // 씬 (게임 화면)
    uniform sampler2D uBloom;   // 브라이트패스 블룸 (이미 흐려진 것)
    uniform float uBloomGain;   // 블룸 HDR 게인 (1.0 = LDR 그대로, >1 = HDR처럼 증폭)
    uniform float uExposure;   // 전체 노출

    // ===== Khronos PBR Neutral (공식) =====
    // Input color is non-negative and resides in the Linear Rec. 709 color space.
    // Output color is also Linear Rec. 709, but in the [0, 1] range.
    vec3 PBRNeutralToneMapping(vec3 color) {
      const float startCompression = 0.8 - 0.04;
      const float desaturation = 0.15;

      float x = min(color.r, min(color.g, color.b));
      float offset = x < 0.08 ? x - 6.25 * x * x : 0.04;
      color -= offset;

      float peak = max(color.r, max(color.g, color.b));
      if (peak < startCompression) return color;

      const float d = 1.0 - startCompression;
      float newPeak = 1.0 - d * d / (peak + d - startCompression);
      color *= newPeak / peak;

      float g = 1.0 - 1.0 / (desaturation * (peak - newPeak) + 1.0);
      return mix(color, newPeak * vec3(1.0, 1.0, 1.0), g);
    }

    void main() {
      vec3 scene = texture2D(uScene, vUV).rgb;
      vec3 bloom = texture2D(uBloom, vUV).rgb;
      // HDR 합성: 클램핑 없이 게인을 곱해 더한다 — 여기서 1.0을 넘어도
      // 톤매퍼가 아래에서 지적으로 롤오프시킨다
      vec3 hdr = scene + bloom * uBloomGain;
      hdr *= uExposure;
      vec3 mapped = PBRNeutralToneMapping(hdr);
      // 미세한 필름림 감마 (sRGB 씬을 리니어로 다루는 근사 보정)
      gl_FragColor = vec4(pow(mapped, vec3(1.0 / 1.06)), 1.0);
    }
  `,

  init() {
    try {
      // WebGL 컨텍스트 (씬 캔버스 자체가 아니라 별도 버퍼로 출력)
      this.canvas = document.createElement('canvas');
      this.gl = this.canvas.getContext('webgl', { antialias: false, preserveDrawingBuffer: true });
      if (!this.gl) return false;

      const gl = this.gl;
      const compile = (type, src) => {
        const s = gl.createShader(type);
        gl.shaderSource(s, src);
        gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
          console.warn('tonemap shader:', gl.getShaderInfoLog(s));
          return null;
        }
        return s;
      };
      const vs = compile(gl.VERTEX_SHADER, this.VERT);
      const fs = compile(gl.FRAGMENT_SHADER, this.FRAG);
      if (!vs || !fs) return false;
      const prog = gl.createProgram();
      gl.attachShader(prog, vs); gl.attachShader(prog, fs);
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return false;
      this.prog = prog;

      // 풀스크린 쿼드
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      this.quad = buf;

      this.texScene = gl.createTexture();
      this.texBloom = gl.createTexture();
      this.enabled = true;
      this.resize();
      return true;
    } catch (e) {
      console.warn('tonemap init fail', e);
      return false;
    }
  },

  resize() {
    if (!this.gl) return;
    this.canvas.width = Math.max(2, G.view.w | 0);
    this.canvas.height = Math.max(2, G.view.h | 0);
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
  },

  /* 최종 합성: 씬 + 블룸 → 톤맵 → 화면 outCtx */
  composite(outCtx, sceneCanvas, bloomCanvas, bloomGain, exposure) {
    if (!this.enabled) return false;
    const gl = this.gl;
    const W = this.canvas.width, H = this.canvas.height;

    gl.useProgram(this.prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
    const loc = gl.getAttribLocation(this.prog, 'aPos');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const bind = (tex, unit, canvas) => {
      gl.activeTexture(unit);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
    };
    bind(this.texScene, gl.TEXTURE0, sceneCanvas);
    bind(this.texBloom, gl.TEXTURE1, bloomCanvas);

    gl.uniform1i(gl.getUniformLocation(this.prog, 'uScene'), 0);
    gl.uniform1i(gl.getUniformLocation(this.prog, 'uBloom'), 1);
    gl.uniform1f(gl.getUniformLocation(this.prog, 'uBloomGain'), bloomGain);
    gl.uniform1f(gl.getUniformLocation(this.prog, 'uExposure'), exposure);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    // 톤맵 결과를 화면으로
    outCtx.setTransform(1, 0, 0, 1, 0, 0);
    outCtx.globalCompositeOperation = 'source-over';
    outCtx.globalAlpha = 1;
    outCtx.drawImage(this.canvas, 0, 0, G.view.w, G.view.h);
    return true;
  },
};

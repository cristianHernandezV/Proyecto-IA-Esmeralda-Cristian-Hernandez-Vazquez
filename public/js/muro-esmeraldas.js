(function (global) {
  const PALETAS = [
    { light: "#7dffc9", base: "#0f6e56", dark: "#04352c", facetA: "rgba(190,255,230,0.42)", facetB: "rgba(4,40,32,0.38)", core: "rgba(209,250,229,0.55)", edge: "rgba(6,78,59,0.95)", extrusion: "#02201a" },
    { light: "#5eead4", base: "#0f766e", dark: "#042f2e", facetA: "rgba(153,246,228,0.4)", facetB: "rgba(19,78,74,0.42)", core: "rgba(204,251,241,0.5)", edge: "rgba(17,94,89,0.95)", extrusion: "#01211f" },
    { light: "#34d399", base: "#047857", dark: "#022c22", facetA: "rgba(167,243,208,0.44)", facetB: "rgba(6,78,59,0.4)", core: "rgba(209,250,229,0.52)", edge: "rgba(6,95,70,0.95)", extrusion: "#011910" },
    { light: "#4ade80", base: "#15803d", dark: "#052e16", facetA: "rgba(187,247,208,0.4)", facetB: "rgba(22,101,52,0.4)", core: "rgba(220,252,231,0.48)", edge: "rgba(21,128,61,0.92)", extrusion: "#02210e" },
  ];

  function azar(min, max) {
    return min + Math.random() * (max - min);
  }

  function clamp(valor, min, max) {
    return Math.max(min, Math.min(max, valor));
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function easeOutBack(t) {
    const c = 1.70158;
    const x = t - 1;
    return 1 + (c + 1) * x * x * x + c * x * x;
  }

  function easeInCubic(t) {
    return t * t * t;
  }

  function verticesHex(radio, rotacion) {
    const verts = [];
    for (let i = 0; i < 6; i += 1) {
      const a = rotacion + (Math.PI / 3) * i;
      verts.push([Math.cos(a) * radio, Math.sin(a) * radio]);
    }
    return verts;
  }

  function trazarPoligono(ctx, verts) {
    ctx.beginPath();
    ctx.moveTo(verts[0][0], verts[0][1]);
    for (let i = 1; i < verts.length; i += 1) {
      ctx.lineTo(verts[i][0], verts[i][1]);
    }
    ctx.closePath();
  }

  function dibujarGema(ctx, verts, radio, colores, opciones) {
    const opts = opciones || {};
    const extrusion = opts.extrusion !== false;
    const brillo = opts.brillo == null ? 1 : opts.brillo;

    if (extrusion) {
      ctx.save();
      ctx.translate(radio * 0.08, radio * 0.14);
      trazarPoligono(ctx, verts);
      ctx.fillStyle = colores.extrusion;
      ctx.fill();
      ctx.restore();
    }

    const grad = ctx.createLinearGradient(-radio, -radio, radio * 0.85, radio);
    grad.addColorStop(0, colores.light);
    grad.addColorStop(0.42, colores.base);
    grad.addColorStop(1, colores.dark);
    trazarPoligono(ctx, verts);
    ctx.fillStyle = grad;
    ctx.fill();

    for (let i = 0; i < verts.length; i += 1) {
      const a = verts[i];
      const b = verts[(i + 1) % verts.length];
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(a[0], a[1]);
      ctx.lineTo(b[0], b[1]);
      ctx.closePath();
      const brillo = 0.1 + 0.07 * Math.sin(i * 2.1 + radio);
      ctx.fillStyle = i % 2 === 0
        ? "rgba(167,243,208," + brillo + ")"
        : "rgba(15, 90, 72," + (0.14 + brillo) + ")";
      ctx.fill();
    }

    ctx.beginPath();
    for (let i = 0; i < 6; i += 1) {
      const a = Math.PI / 6 + (Math.PI / 3) * i;
      const rr = radio * 0.36;
      const x = Math.cos(a) * rr;
      const y = Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = colores.core;
    ctx.fill();

    trazarPoligono(ctx, verts);
    ctx.strokeStyle = colores.edge;
    ctx.lineWidth = Math.max(0.8, radio * 0.035);
    ctx.stroke();

    ctx.beginPath();
    ctx.ellipse(-radio * 0.28, -radio * 0.34, radio * 0.22, radio * 0.11, -0.55, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255," + (0.28 * brillo) + ")";
    ctx.fill();

    if (opts.oro) {
      ctx.beginPath();
      ctx.moveTo(radio * 0.12, radio * 0.08);
      ctx.lineTo(radio * 0.32, radio * 0.18);
      ctx.lineTo(radio * 0.16, radio * 0.34);
      ctx.closePath();
      ctx.fillStyle = "rgba(196,163,90,0.55)";
      ctx.fill();
    }
  }

  function construirMuro(ancho, alto) {
    const radio = ancho < 640 ? 30 : ancho < 1100 ? 38 : 44;
    const pasoX = Math.sqrt(3) * radio;
    const pasoY = radio * 1.5;
    const cristales = [];
    let fila = 0;
    const inicioY = -pasoY;
    const inicioX = -pasoX;

    for (let y = inicioY; y < alto + pasoY * 2; y += pasoY) {
      const ox = fila % 2 === 1 ? pasoX / 2 : 0;
      for (let x = inicioX + ox; x < ancho + pasoX; x += pasoX) {
        const nx = x / ancho;
        const ny = y / alto;
        const paleta = PALETAS[Math.floor(Math.random() * PALETAS.length)];
        const radioCristal = radio * 1.045;
        cristales.push({
          x: x,
          y: y,
          radio: radioCristal,
          rotRepos: azar(-0.04, 0.04),
          verts: verticesHex(radioCristal, Math.PI / 6),
          colores: paleta,
          oro: Math.random() < 0.12,
          appearDelay: (1 - clamp(ny, 0, 1)) * 0.72 + azar(0, 0.08) + Math.abs(nx - 0.5) * 0.12,
          breakDelay: 0,
          escala: 0,
          rot: azar(-0.4, 0.4),
          alpha: 1,
          estado: "espera",
          fragmentos: null,
        });
      }
      fila += 1;
    }

    return { cristales: cristales, radio: radio };
  }

  function generarGrietas(ox, oy, ancho, alto) {
    const grietas = [];
    const ramas = 11 + Math.floor(Math.random() * 5);

    function rama(x0, y0, ang, segs, groso) {
      const pts = [{ x: x0, y: y0, g: groso }];
      let x = x0;
      let y = y0;
      let a = ang;
      for (let s = 0; s < segs; s += 1) {
        a += azar(-0.62, 0.62);
        const len = azar(18, 78);
        x += Math.cos(a) * len;
        y += Math.sin(a) * len;
        pts.push({ x: x, y: y, g: groso * (1 - s / (segs + 1)) });
        if (s > 1 && Math.random() < 0.32 && segs > 3) {
          grietas.push(rama(x, y, a + azar(-1.1, 1.1), Math.floor(segs * 0.45), groso * 0.55));
        }
        if (x < -40 || y < -40 || x > ancho + 40 || y > alto + 40) break;
      }
      return pts;
    }

    for (let i = 0; i < ramas; i += 1) {
      const ang = (Math.PI * 2 * i) / ramas + azar(-0.28, 0.28);
      grietas.push(rama(ox, oy, ang, 7 + Math.floor(Math.random() * 7), azar(1.4, 2.6)));
    }
    return grietas.filter(function (g) { return g && g.length > 1; });
  }

  function crearFragmentos(cristal, impactoX, impactoY) {
    const fragmentos = [];
    const verts = cristal.verts;
    for (let i = 0; i < 6; i += 2) {
      const pieza = [
        [0, 0],
        verts[i],
        verts[(i + 1) % 6],
        verts[(i + 2) % 6],
      ];
      const ang = Math.atan2(cristal.y - impactoY, cristal.x - impactoX) + azar(-0.55, 0.55);
      const vel = azar(220, 620);
      fragmentos.push({
        verts: pieza,
        x: cristal.x,
        y: cristal.y,
        rot: cristal.rotRepos,
        vx: Math.cos(ang) * vel + azar(-60, 60),
        vy: Math.sin(ang) * vel - azar(40, 220),
        vr: azar(-10, 10),
        alpha: 1,
        radio: cristal.radio,
        colores: cristal.colores,
        oro: cristal.oro && i === 0,
      });
    }
    return fragmentos;
  }

  function dibujarCristalEn(ctx, cristal) {
    ctx.save();
    ctx.translate(cristal.x, cristal.y);
    ctx.rotate(cristal.rotRepos + (cristal.rot || 0));
    ctx.scale(cristal.escala, cristal.escala);
    ctx.globalAlpha *= cristal.alpha;
    dibujarGema(ctx, cristal.verts, cristal.radio, cristal.colores, { oro: cristal.oro });
    ctx.restore();
  }

  function dibujarFragmento(ctx, frag) {
    ctx.save();
    ctx.translate(frag.x, frag.y);
    ctx.rotate(frag.rot);
    ctx.globalAlpha *= frag.alpha;
    dibujarGema(ctx, frag.verts, frag.radio, frag.colores, {
      extrusion: false,
      oro: frag.oro,
      brillo: 0.7,
    });
    ctx.restore();
  }

  function dibujarGrietas(ctx, grietas, progreso) {
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    grietas.forEach(function (pts) {
      const visible = Math.max(2, Math.floor(pts.length * progreso));
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < visible; i += 1) {
        ctx.lineTo(pts[i].x, pts[i].y);
      }
      ctx.strokeStyle = "rgba(2, 16, 12, 0.82)";
      ctx.lineWidth = pts[0].g;
      ctx.stroke();
      ctx.strokeStyle = "rgba(167, 243, 208, 0.28)";
      ctx.lineWidth = Math.max(0.6, pts[0].g * 0.35);
      ctx.stroke();
    });
    ctx.restore();
  }

  function reproducirMuroEsmeraldas(opciones) {
    const opts = opciones || {};
    const alCubrir = typeof opts.alCubrir === "function" ? opts.alCubrir : function () {};
    const alTerminar = typeof opts.alTerminar === "function" ? opts.alTerminar : function () {};
    const overlay = document.getElementById("muro-esmeraldas");
    const canvas = document.getElementById("muro-esmeraldas-lienzo");
    if (!overlay || !canvas || !canvas.getContext) {
      alCubrir();
      alTerminar();
      return function () {};
    }

    const ctx = canvas.getContext("2d");
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const ancho = window.innerWidth;
    const alto = window.innerHeight;
    canvas.width = Math.max(1, Math.floor(ancho * dpr));
    canvas.height = Math.max(1, Math.floor(alto * dpr));
    canvas.style.width = ancho + "px";
    canvas.style.height = alto + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const muro = construirMuro(ancho, alto);
    const cristales = muro.cristales;
    const impacto = {
      x: ancho * azar(0.38, 0.62),
      y: alto * azar(0.32, 0.52),
    };
    cristales.forEach(function (c) {
      c.breakDelay = Math.hypot(c.x - impacto.x, c.y - impacto.y) * 0.0007 + azar(0, 0.06);
    });
    const grietas = generarGrietas(impacto.x, impacto.y, ancho, alto);
    const chispas = [];

    const T_CUBRIR = 0.92;
    const T_BRILLO = 1.28;
    const T_GRIETA = 1.62;
    const T_ROMPER = 1.7;
    const T_FIN = 4.05;

    let cubierto = false;
    let terminado = false;
    let raf = 0;
    let ultimo = 0;
    const t0 = performance.now();

    overlay.hidden = false;
    overlay.style.background = "#02120e";
    overlay.setAttribute("aria-hidden", "false");
    overlay.setAttribute("aria-busy", "true");
    document.body.classList.add("muro-esmeraldas-activo");

    function soltarChispas(x, y, n, fuerza) {
      for (let i = 0; i < n; i += 1) {
        const ang = azar(0, Math.PI * 2);
        const vel = azar(40, fuerza);
        chispas.push({
          x: x,
          y: y,
          vx: Math.cos(ang) * vel,
          vy: Math.sin(ang) * vel - azar(20, 140),
          vida: azar(0.28, 0.7),
          max: 0,
          r: azar(1.1, 3.2),
          color: Math.random() < 0.35 ? "rgba(196,163,90,0.9)" : "rgba(167,243,208,0.95)",
        });
        chispas[chispas.length - 1].max = chispas[chispas.length - 1].vida;
      }
    }

    function limpiar() {
      if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      overlay.hidden = true;
      overlay.style.background = "";
      overlay.setAttribute("aria-hidden", "true");
      overlay.removeAttribute("aria-busy");
      document.body.classList.remove("muro-esmeraldas-activo");
    }

    function terminar(notificar) {
      if (terminado) return;
      terminado = true;
      limpiar();
      if (notificar) alTerminar();
    }

    function cuadro(ahora) {
      if (terminado) return;
      const t = (ahora - t0) / 1000;
      const dt = Math.min(0.033, ultimo ? (ahora - ultimo) / 1000 : 0.016);
      ultimo = ahora;

      if (!cubierto && t >= T_CUBRIR * 0.88) {
        cubierto = true;
        alCubrir();
      }

      const temblor = t >= T_GRIETA && t < T_GRIETA + 0.38
        ? (1 - (t - T_GRIETA) / 0.38) * 7
        : t > 0.78 && t < 0.98
          ? (1 - (t - 0.78) / 0.2) * 3
          : 0;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, ancho, alto);

      ctx.save();
      if (temblor > 0.2) {
        ctx.translate((Math.random() - 0.5) * temblor, (Math.random() - 0.5) * temblor);
      }

      let fondo = 0;
      if (t < T_ROMPER) {
        fondo = clamp(t / 0.16, 0, 1);
      } else {
        overlay.style.background = "transparent";
        fondo = clamp(1 - (t - T_ROMPER) / 0.22, 0, 1);
      }
      if (fondo > 0.01) {
        ctx.fillStyle = "rgba(2, 18, 14," + (0.92 * fondo) + ")";
        ctx.fillRect(-20, -20, ancho + 40, alto + 40);
      }

      const durAppear = 0.38;
      cristales.forEach(function (c) {
        if (c.estado === "vuelo") return;
        const local = (t - c.appearDelay) / durAppear;
        if (local <= 0) {
          c.escala = 0;
          return;
        }
        if (c.estado === "espera") c.estado = "solido";
        c.escala = local >= 1 ? 1 : easeOutBack(clamp(local, 0, 1));
        c.rot = lerp(c.rot, 0, clamp(local, 0, 1));
        if (t >= T_ROMPER && t - T_ROMPER >= c.breakDelay && c.estado === "solido") {
          c.estado = "vuelo";
          c.fragmentos = crearFragmentos(c, impacto.x, impacto.y);
          soltarChispas(c.x, c.y, 4 + Math.floor(Math.random() * 4), 280);
        }
      });

      cristales.forEach(function (c) {
        if (c.estado !== "solido" || c.escala <= 0.02) return;
        dibujarCristalEn(ctx, c);
      });

      if (t >= T_BRILLO && t < T_GRIETA + 0.15) {
        const p = easeInCubic(clamp((t - T_BRILLO) / (T_GRIETA - T_BRILLO), 0, 1));
        const sx = lerp(-ancho * 0.3, ancho * 1.1, p);
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        const banda = ctx.createLinearGradient(sx, 0, sx + ancho * 0.18, alto * 0.12);
        banda.addColorStop(0, "rgba(255,255,255,0)");
        banda.addColorStop(0.5, "rgba(190,255,230,0.16)");
        banda.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = banda;
        ctx.translate(ancho / 2, alto / 2);
        ctx.rotate(-0.4);
        ctx.translate(-ancho / 2, -alto / 2);
        ctx.fillRect(-ancho, -alto, ancho * 3, alto * 3);
        ctx.restore();
      }

      if (t >= T_GRIETA) {
        const pg = clamp((t - T_GRIETA) / 0.32, 0, 1);
        dibujarGrietas(ctx, grietas, easeOutCubic(pg));
        if (t < T_GRIETA + 0.18) {
          const flash = 1 - (t - T_GRIETA) / 0.18;
          const halo = ctx.createRadialGradient(impacto.x, impacto.y, 8, impacto.x, impacto.y, 220);
          halo.addColorStop(0, "rgba(236,253,245," + (0.55 * flash) + ")");
          halo.addColorStop(0.4, "rgba(52,211,153," + (0.22 * flash) + ")");
          halo.addColorStop(1, "rgba(15,110,102,0)");
          ctx.fillStyle = halo;
          ctx.fillRect(0, 0, ancho, alto);
          if (t - T_GRIETA < dt * 2) soltarChispas(impacto.x, impacto.y, 28, 520);
        }
      }

      cristales.forEach(function (c) {
        if (c.estado !== "vuelo" || !c.fragmentos) return;
        c.fragmentos.forEach(function (f) {
          f.vy += 1280 * dt;
          f.vx *= Math.pow(0.28, dt);
          f.x += f.vx * dt;
          f.y += f.vy * dt;
          f.rot += f.vr * dt;
          f.alpha = clamp(f.alpha - dt * 0.42, 0, 1);
          if (f.alpha > 0.02 && f.y < alto + 120) dibujarFragmento(ctx, f);
        });
      });

      for (let i = chispas.length - 1; i >= 0; i -= 1) {
        const p = chispas[i];
        p.vida -= dt;
        p.vy += 900 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.vida <= 0) {
          chispas.splice(i, 1);
          continue;
        }
        ctx.globalAlpha = p.vida / p.max;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      const vineta = ctx.createRadialGradient(
        ancho / 2,
        alto / 2,
        Math.min(ancho, alto) * 0.2,
        ancho / 2,
        alto / 2,
        Math.max(ancho, alto) * 0.72
      );
      const vinetaA = t < T_ROMPER ? 0.38 : clamp(0.38 - (t - T_ROMPER) * 0.22, 0, 0.38);
      vineta.addColorStop(0, "rgba(0,0,0,0)");
      vineta.addColorStop(1, "rgba(1,12,10," + vinetaA + ")");
      ctx.fillStyle = vineta;
      ctx.fillRect(0, 0, ancho, alto);

      ctx.restore();

      if (t >= T_FIN) {
        terminar(true);
        return;
      }
      raf = requestAnimationFrame(cuadro);
    }

    raf = requestAnimationFrame(cuadro);

    return function cancelar() {
      terminar(false);
    };
  }

  global.reproducirMuroEsmeraldas = reproducirMuroEsmeraldas;
})(window);

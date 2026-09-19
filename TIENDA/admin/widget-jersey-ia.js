// admin/widget-jersey-ia.js
//
// Widget personalizado para Decap CMS: muestra un campo de "URL de la imagen"
// (pegas el link, ya no se sube archivo), un botón "Autocompletar con IA"
// que llama a la función de Netlify /.netlify/functions/analizar-imagen,
// y los campos nombre / precio / liga (opcional) / equipo.
//
// Se registra como widget: "jerseyIA" — se usa en config.yml.

var JerseyIAControl = createClass({
  getInitialState: function () {
    var v = this.props.value;
    var obj = v && typeof v.toJS === "function" ? v.toJS() : v || {};
    var imagenes = obj.imagenes;
    if (imagenes && typeof imagenes.toJS === "function") imagenes = imagenes.toJS();
    if (!imagenes || !imagenes.length) {
      imagenes = obj.img ? [obj.img] : [""];
    }
    return {
      imagenes: imagenes,
      nombre: obj.nombre || "",
      precio: obj.precio || "",
      liga: obj.liga || "",
      equipo: obj.equipo || "",
      cargando: false,
      mensaje: "",
    };
  },

  emitChange: function (patch) {
    var full = Object.assign({}, this.state, patch);
    var imagenesLimpias = full.imagenes.filter(function (u) {
      return u && u.trim();
    });
    this.props.onChange({
      imagenes: imagenesLimpias,
      img: imagenesLimpias[0] || "", // se mantiene por compatibilidad con el catálogo
      nombre: full.nombre,
      precio: full.precio,
      liga: full.liga,
      equipo: full.equipo,
    });
  },

  actualizarFoto: function (indice, valor) {
    var imagenes = this.state.imagenes.slice();
    imagenes[indice] = valor;
    this.setState(
      { imagenes: imagenes },
      function () {
        this.emitChange({ imagenes: imagenes });
      }.bind(this)
    );
  },

  agregarFoto: function () {
    var imagenes = this.state.imagenes.slice();
    imagenes.push("");
    this.setState({ imagenes: imagenes });
  },

  quitarFoto: function (indice) {
    var imagenes = this.state.imagenes.slice();
    imagenes.splice(indice, 1);
    if (imagenes.length === 0) imagenes = [""];
    this.setState(
      { imagenes: imagenes },
      function () {
        this.emitChange({ imagenes: imagenes });
      }.bind(this)
    );
  },

  actualizar: function (campo, valor) {
    var patch = {};
    patch[campo] = valor;
    this.setState(
      patch,
      function () {
        this.emitChange(patch);
      }.bind(this)
    );
  },

  matchEquipo: function (texto) {
    var opciones = this.props.field.get("opcionesEquipo");
    if (!opciones) return texto || "";
    if (!texto) return "";
    var norm = function (s) {
      return String(s)
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");
    };
    var buscado = norm(texto);
    var encontrado = "";
    opciones.forEach(function (op) {
      var label = op.get("label");
      var value = op.get("value");
      if (
        norm(label) === buscado ||
        norm(value) === buscado ||
        norm(label).indexOf(buscado) !== -1 ||
        buscado.indexOf(norm(value)) !== -1
      ) {
        encontrado = value;
      }
    });
    return encontrado;
  },

  autocompletar: function () {
    var self = this;
    var primeraFoto = this.state.imagenes[0];
    if (!primeraFoto) {
      this.setState({ mensaje: "Pega primero el link de al menos una imagen." });
      return;
    }
    this.setState({ cargando: true, mensaje: "" });

    fetch("/.netlify/functions/analizar-imagen", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageUrl: primeraFoto }),
    })
      .then(function (res) {
        return res.json().then(function (data) {
          return { ok: res.ok, data: data };
        });
      })
      .then(function (r) {
        if (!r.ok) {
          self.setState({
            cargando: false,
            mensaje: "Error: " + (r.data.error || "no se pudo analizar la imagen"),
          });
          return;
        }
        var equipoDetectado = self.matchEquipo(r.data.equipo);
        var patch = {
          nombre: r.data.nombre || self.state.nombre,
          equipo: equipoDetectado || self.state.equipo,
        };
        var aviso = equipoDetectado
          ? "Listo. Revisa los datos antes de publicar."
          : "Listo, pero no reconocí el equipo en la lista — selecciónalo tú abajo.";
        self.setState(
          Object.assign({ cargando: false, mensaje: aviso }, patch),
          function () {
            self.emitChange(patch);
          }
        );
      })
      .catch(function (err) {
        self.setState({ cargando: false, mensaje: "Error de red: " + err.message });
      });
  },

  estiloSelect: function (valor, marginAbajo) {
    return {
      width: "100%",
      padding: "8px",
      fontSize: "14px",
      borderRadius: "4px",
      marginBottom: marginAbajo ? "0px" : "0px",
      border: valor ? "2px solid #3AA76D" : "2px solid #B00020",
      background: valor ? "#F3FBF6" : "#FFFFFF",
    };
  },

  render: function () {
    var self = this;
    var mostrarLiga = this.props.field.get("mostrarLiga");
    var opcionesLiga = this.props.field.get("opcionesLiga");
    var opcionesEquipo = this.props.field.get("opcionesEquipo");

    return h(
      "div",
      { style: { border: "1px solid #d8d8d8", borderRadius: "8px", padding: "14px" } },

      h("label", { style: { fontWeight: "bold", display: "block", marginBottom: "4px" } }, "Fotos"),
      h(
        "div",
        { style: { marginBottom: "8px" } },
        this.state.imagenes.map(function (url, indice) {
          return h(
            "div",
            { key: "foto_" + indice, style: { display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" } },
            h("input", {
              type: "text",
              value: url,
              placeholder: indice === 0 ? "https://... (foto principal)" : "https://... (foto extra)",
              style: { flex: "1", padding: "6px" },
              onChange: function (e) {
                self.actualizarFoto(indice, e.target.value);
              },
            }),
            url
              ? h("img", { src: url, style: { width: "40px", height: "40px", objectFit: "cover", borderRadius: "4px" } })
              : null,
            self.state.imagenes.length > 1
              ? h(
                  "button",
                  {
                    type: "button",
                    onClick: function (e) {
                      e.preventDefault();
                      self.quitarFoto(indice);
                    },
                    style: { padding: "4px 8px", cursor: "pointer" },
                  },
                  "✕"
                )
              : null
          );
        })
      ),
      h(
        "button",
        {
          type: "button",
          onClick: function (e) {
            e.preventDefault();
            self.agregarFoto();
          },
          style: { marginBottom: "10px", padding: "6px 12px", cursor: "pointer" },
        },
        "+ Agregar otra foto"
      ),

      h(
        "button",
        {
          type: "button",
          disabled: this.state.cargando,
          onClick: function (e) {
            e.preventDefault();
            self.autocompletar();
          },
          style: { marginBottom: "10px", padding: "8px 14px", cursor: "pointer" },
        },
        this.state.cargando ? "Analizando..." : "🤖 Autocompletar con IA"
      ),

      this.state.mensaje
        ? h("div", { style: { fontSize: "12px", marginBottom: "10px", color: "#555" } }, this.state.mensaje)
        : null,

      h("label", { style: { fontWeight: "bold", display: "block", marginBottom: "4px" } }, "Nombre"),
      h("input", {
        type: "text",
        value: this.state.nombre,
        style: { width: "100%", marginBottom: "8px", padding: "6px" },
        onChange: function (e) {
          self.actualizar("nombre", e.target.value);
        },
      }),

      h("label", { style: { fontWeight: "bold", display: "block", marginBottom: "4px" } }, "Precio"),
      h("input", {
        type: "text",
        value: this.state.precio,
        style: { width: "100%", marginBottom: "8px", padding: "6px" },
        onChange: function (e) {
          self.actualizar("precio", e.target.value);
        },
      }),

      mostrarLiga
        ? h(
            "div",
            { style: this.state.liga ? {} : { background: "#FFF6F6", padding: "8px", borderRadius: "6px", marginBottom: "4px" } },
            h(
              "label",
              { style: { fontWeight: "bold", display: "block", marginBottom: "4px", color: this.state.liga ? "#000" : "#B00020" } },
              "Liga / selección " + (this.state.liga ? "" : "❗ OBLIGATORIO — sin elegir todavía")
            ),
            h(
              "select",
              {
                value: this.state.liga,
                style: this.estiloSelect(this.state.liga, true),
                onChange: function (e) {
                  self.actualizar("liga", e.target.value);
                },
              },
              [h("option", { key: "_vacio", value: "" }, "— Sin elegir, toca aquí —")].concat(
                opcionesLiga
                  ? opcionesLiga
                      .map(function (op) {
                        return h("option", { key: op.get("value"), value: op.get("value") }, op.get("label"));
                      })
                      .toArray()
                  : []
              )
            )
          )
        : null,

      h(
        "div",
        { style: this.state.equipo ? {} : { background: "#FFF6F6", padding: "8px", borderRadius: "6px" } },
        h(
          "label",
          { style: { fontWeight: "bold", display: "block", marginBottom: "4px", color: this.state.equipo ? "#000" : "#B00020" } },
          (mostrarLiga ? "Equipo / selección " : "Equipo ") + (this.state.equipo ? "" : "❗ OBLIGATORIO — sin elegir todavía")
        ),
        opcionesEquipo
          ? h(
              "select",
              {
                value: this.state.equipo,
                style: this.estiloSelect(this.state.equipo, false),
                onChange: function (e) {
                  self.actualizar("equipo", e.target.value);
                },
              },
              [h("option", { key: "_vacio", value: "" }, "— Sin elegir, toca aquí —")].concat(
                opcionesEquipo
                  .map(function (op) {
                    return h("option", { key: op.get("value"), value: op.get("value") }, op.get("label"));
                  })
                  .toArray()
              )
            )
          : h("input", {
              type: "text",
              value: this.state.equipo,
              placeholder: "Escribe el equipo (obligatorio)",
              style: this.estiloSelect(this.state.equipo, false),
              onChange: function (e) {
                self.actualizar("equipo", e.target.value);
              },
            })
      )
    );
  },
});

var JerseyIAPreview = createClass({
  render: function () {
    var v = this.props.value;
    var obj = v && typeof v.toJS === "function" ? v.toJS() : v || {};
    var faltante = !obj.equipo ? " ⚠️ falta equipo" : "";
    return h("div", null, (obj.nombre || "(sin nombre)") + " — " + (obj.equipo || "(sin equipo)") + faltante);
  },
});

CMS.registerWidget("jerseyIA", JerseyIAControl, JerseyIAPreview);

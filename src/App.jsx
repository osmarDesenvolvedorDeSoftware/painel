import { useEffect, useState } from 'react';
import axios from 'axios';

const API_URL = "https://api-cc33.onrender.com";
const SENHA_FIXA = "farmacia2025";

function App() {
  const [logado, setLogado] = useState(false);
  const [senha, setSenha] = useState("");

  const [pedidos, setPedidos] = useState([]);
  const [fotos, setFotos] = useState([]);
  const [pedidoSelecionado, setPedidoSelecionado] = useState("");
  const [pedidoManual, setPedidoManual] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("painel_auth");
    if (token === SENHA_FIXA) setLogado(true);
  }, []);

  const login = () => {
    if (senha === SENHA_FIXA) {
      localStorage.setItem("painel_auth", senha);
      setLogado(true);
    } else {
      alert("Senha incorreta");
    }
  };

  const logout = () => {
    localStorage.removeItem("painel_auth");
    setLogado(false);
    setSenha("");
  };

  const buscarPedidos = () => {
    axios.get(`${API_URL}/fotos`)
      .then(res => setPedidos(res.data.pedidos))
      .catch(err => console.error("Erro ao buscar pedidos:", err));
  };

  useEffect(() => {
    if (logado) {
      buscarPedidos();
    }
  }, [logado]);

  const carregarFotos = (pedido) => {
    axios.get(`${API_URL}/fotos/${pedido}`)
      .then(res => {
        setFotos(res.data.fotos);
        setPedidoSelecionado(pedido);
      })
      .catch(err => {
        setFotos([]);
        setPedidoSelecionado(pedido);
        alert("Pedido não encontrado.");
      });
  };

  if (!logado) {
    return (
      <div style={{
        display: "flex", flexDirection: "column", alignItems: "center",
        justifyContent: "center", minHeight: "100vh", fontFamily: "Arial"
      }}>
        <h2>🔒 Painel Farmácia</h2>
        <input
          type="password"
          placeholder="Digite a senha"
          value={senha}
          onChange={e => setSenha(e.target.value)}
          style={{ padding: "0.5rem", marginBottom: "1rem", width: "200px" }}
        />
        <button onClick={login} style={{ padding: "0.5rem 1rem", cursor: "pointer" }}>
          Entrar
        </button>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      alignItems: "flex-start",
      padding: "2rem",
      fontFamily: "Arial",
      maxWidth: "900px",
      margin: "0 auto"
    }}>
      <div style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 style={{ marginBottom: "1rem" }}>Seja bem-vinda, Luana Ribeiro Cavalcante 💙</h1>
        <button onClick={logout} style={{ padding: "0.4rem 0.8rem", cursor: "pointer" }}>
          Sair
        </button>
      </div>

      <div style={{ marginBottom: "1rem", display: "flex", gap: "0.5rem" }}>
        <input
          type="text"
          placeholder="Buscar pedido manualmente..."
          value={pedidoManual}
          onChange={e => setPedidoManual(e.target.value)}
          style={{ padding: "0.5rem", width: "300px" }}
        />
        <button
          onClick={() => carregarFotos(pedidoManual)}
          style={{ padding: "0.5rem 1rem", cursor: "pointer" }}
        >
          Buscar
        </button>
        <button
          onClick={buscarPedidos}
          style={{ padding: "0.5rem 1rem", cursor: "pointer", backgroundColor: "#666", color: "white" }}
        >
          🔁 Atualizar Pedidos
        </button>
      </div>

      <h2>Pedidos:</h2>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem", marginBottom: "2rem" }}>
        {pedidos.map(pedido => (
          <button
            key={pedido}
            onClick={() => carregarFotos(pedido)}
            style={{
              padding: "0.5rem 1rem",
              background: pedido === pedidoSelecionado ? "#333" : "#2196F3",
              color: "white",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer"
            }}
          >
            Pedido {pedido}
          </button>
        ))}
      </div>

      {pedidoSelecionado && fotos.length > 0 && (
        <>
          <h2>Fotos do Pedido {pedidoSelecionado}:</h2>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem" }}>
            {fotos.map(foto => (
              <img
                key={foto}
                src={`${API_URL}/fotos/${pedidoSelecionado}/${foto}`}
                alt={foto}
                style={{
                  width: "250px",
                  height: "auto",
                  borderRadius: "8px",
                  boxShadow: "0 0 10px rgba(0,0,0,0.2)"
                }}
              />
            ))}
          </div>
        </>
      )}

      {pedidoSelecionado && fotos.length === 0 && (
        <p style={{ color: "gray" }}>Nenhuma foto encontrada para o pedido {pedidoSelecionado}.</p>
      )}
    </div>
  );
}

export default App;

# Como iniciar o projeto

Este projeto roda com **Docker** (Node.js + PostgreSQL), então você não precisa instalar banco de dados nem configurar nada manualmente.

## Pré-requisito
- Ter o **Docker Desktop** instalado e aberto no computador.

---

## Como iniciar (pelo Docker Desktop)

Como os containers já foram criados, no dia a dia basta:

1. Abrir o **Docker Desktop**.
2. Ir na aba **Containers**.
3. Encontrar o grupo **`pathmatch`** e clicar no botão **Play (▶)**.
4. Abrir o navegador e acessar: **http://localhost:3000**

Para desligar, clique no botão **Stop (■)** no mesmo grupo.

---

## Como iniciar (pelo terminal)

Se preferir usar o terminal na pasta do projeto:

- **Iniciar:**
  ```powershell
  docker compose up -d
  ```
- **Iniciar após alterar código:**
  ```powershell
  docker compose up -d --build
  ```
- **Parar:**
  ```powershell
  docker compose stop
  ```
- **Parar e remover os containers (mantém os dados do banco):**
  ```powershell
  docker compose down
  ```

Depois de iniciar, acesse **http://localhost:3000** no navegador.

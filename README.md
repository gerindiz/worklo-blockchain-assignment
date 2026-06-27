# Worklo Blockchain Assignment — Germán Rindizbacher

Implementación de un sistema de recompensas en blockchain (ERC-20) para tareas completadas en la plataforma Worklo, sobre un nodo local de Hardhat.

---

## 🚀 Cómo correr el proyecto

### Prerequisitos
- Node.js 18+
- Una cuenta gratuita de Supabase

### 1. Instalar dependencias
```bash
npm install
```

### 2. Configurar variables de entorno
Copiá el template y completalo con tus credenciales:
```bash
cp .env.local.template .env.local
```

Variables requeridas (las de blockchain ya están con los defaults canónicos de Hardhat):

```dotenv
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://<tu-proyecto>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=<tu-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<tu-service-role-key>

# Blockchain (Hardhat local)
HARDHAT_RPC_URL=http://127.0.0.1:8545
OWNER_PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
WPT_CONTRACT_ADDRESS=0x5FbDB2315678afecb367f032d93F642f64180aa3
REWARD_RECIPIENT_ADDRESS=0x70997970C51812dc3A010C7d01b50e0d17dc79C8
```

### 3. Cargar el schema en Supabase
Supabase Dashboard → SQL Editor → pegar y ejecutar:
- `supabase/schema.sql`
- `supabase/seed-roles.sql`
- Adicional: `ALTER TABLE tasks ADD COLUMN IF NOT EXISTS tx_hash TEXT;`

### 4. Iniciar el nodo local de Hardhat (terminal 1)
```bash
npx hardhat node
```
Dejá esta terminal corriendo. Imprime 20 cuentas con private keys que se usan localmente sin riesgo real.

### 5. Desplegar el contrato (terminal 2, una sola vez)
```bash
npx hardhat run scripts/deploy.js --network localhost
```
Copiá la dirección que imprime y verificá que coincida con `WPT_CONTRACT_ADDRESS` en `.env.local`.

### 6. Iniciar Next.js (terminal 3)
```bash
npm run dev
```
La app queda disponible en http://localhost:3000

---

## ✅ Qué está implementado

### 1. Smart Contract (`contracts/WorkloToken.sol`)
ERC-20 mínimo basado en OpenZeppelin:
- Hereda de `ERC20` y `Ownable`
- Nombre: `Worklo Platform Token`, símbolo: `WPT`
- Función `mint(address to, uint256 amount)` restringida con `onlyOwner`
- Compatible con Solidity ^0.8.20 y OpenZeppelin v5 (constructor de Ownable recibe el owner inicial)

### 2. Script de deploy (`scripts/deploy.js`)
Desplega el contrato al nodo local de Hardhat usando `ethers` v6 e imprime la dirección final.

### 3. Ruta API (`app/api/tasks/[taskId]/reward/route.js`)
Endpoint `POST /api/tasks/[taskId]/reward` que sigue **exactamente el patrón** de `app/api/roles/route.js`:

- Mismo estilo CommonJS (`require` / `exports.POST`)
- Auth con `requireAuthAndPermission(Permission.MANAGE_TASKS, {}, request)`
- Logging consistente (`logger`, `apiCall`, `apiResponse`, `databaseQuery`)
- Manejo de errores con `handleGuardError`
- Dos clientes Supabase: `createApiSupabaseClient` para reads (respeta RLS) y `createAdminSupabaseClient` para el update del `tx_hash` (bypass RLS)

Flujo del handler:
1. Auth + permission check
2. Fetch de la task por `taskId` (params async, como pide Next.js 15)
3. Validación: la task tiene que existir y tener `status` completado (`done` / `completed`)
4. Anti-doble-mint: si la task ya tiene `tx_hash`, devuelve 400 con el hash existente
5. Setup de `ethers.JsonRpcProvider` + `Wallet` (owner key) + `Contract` con ABI mínimo
6. Llama `mint(REWARD_RECIPIENT, 10 * 10^decimals)` y espera el receipt
7. Guarda el `tx_hash` en `tasks` con el `adminClient`
8. Devuelve `{ txHash }`

Manejo de errores específico para `ECONNREFUSED` / `NETWORK_ERROR` con mensaje accionable ("Hardhat node not reachable").

---

## 🚧 Qué NO terminé y por qué

### Frontend del botón "Recompensar WPT"
**Estado**: la API funciona end-to-end (contrato desplegado, mint exitoso, escritura en Supabase). Falta terminar de pulir los tres estados del botón (loading / success / error) integrados con el componente real del proyecto.

**Por qué**: el repo viene con `NEXT_PUBLIC_DEMO_MODE=true` y la mayoría de los datos del dashboard (proyectos, tareas, deadlines) son mock hardcoded del frontend, no consultas reales a Supabase. La task "Optimizar Smart Contract..." que aparece en el dashboard tiene un id tipo `task-demo-blockchain-1` (string), mientras que la tabla `tasks` de Supabase usa `uuid`. Conectar el botón end-to-end requería decidir entre:

1. Insertar una task real en Supabase con UUID y modificar el mock data del frontend para usarlo (toca código que la consigna pide minimizar)
2. Cambiar `tasks.id` de uuid a text (rompe FKs con `subtasks`, `task_comments`, etc.)
3. Adaptar el handler para que funcione "sin task de Supabase" si la consulta falla (rompe la consigna que pide explícitamente "fetch the task")

Preferí dejar el handler **alineado con la consigna y el patrón del codebase** y documentar este punto en lugar de hackear el frontend.

### Manejo de errores defensivo en el frontend
El componente que usa `apiFetch` hace `r.json()` directo sin chequear `res.ok` ni catchear si la respuesta no es JSON. Esto produce el clásico error `Unexpected token '<', "<!DOCTYPE..."` cuando el backend devuelve HTML (404/500). Lo dejé documentado para arreglar:

```ts
const res = await apiFetch(`/api/tasks/${taskId}/reward`, { method: 'POST' });
const data = await res.json().catch(() => ({ error: 'Invalid JSON response' }));
if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
return data.txHash;
```

---

## 🔮 Qué mejoraría con más tiempo

1. **Conectar el mock data del demo con Supabase real**: hacer un seed script (`supabase/seed-demo.sql`) que inserte un proyecto y 2-3 tasks con UUIDs estables, y reemplazar las constantes del mock del dashboard para que apunten a esos UUIDs. Así el botón funciona end-to-end con el demo, sin necesitar que el evaluador cree datos manualmente.

2. **Hacer el monto del reward configurable por task**: actualmente el handler mintea 10 WPT fijos. Lo extendería con una columna `tasks.reward_amount` (default 10) y leería ese valor en el handler, así distintas tareas pueden tener distintas recompensas (alineado con el modelo PSA de Worklo donde tareas tienen distinto peso).

3. **Recipient dinámico por usuario**: hoy el reward va a una dirección fija de `.env`. En un sistema real cada usuario tendría su wallet asociada a su perfil. Agregaría `user_profiles.wallet_address` y mintearía a la wallet del `assigned_to` de la task, con fallback al `REWARD_RECIPIENT_ADDRESS` de env si la wallet del usuario no está seteada.

4. **Idempotencia más robusta**: la guarda actual contra doble-mint chequea `task.tx_hash` antes de mintear, pero hay una pequeña ventana de carrera entre el SELECT y el UPDATE. Lo cerraría con un `UPDATE ... WHERE tx_hash IS NULL` antes del mint (claim atómico) y revertiría si el mint falla. Para una versión profesional, además usaría una tabla `reward_transactions` con estados (`pending` / `confirmed` / `failed`) y `confirmations` para esperar más bloques.

5. **Frontend states**: implementar el botón con los 3 estados que pide la consigna usando un hook custom `useRewardTask(taskId)` que devuelva `{ reward, isLoading, txHash, error }`. Un componente puro `<RewardButton task={task} />` que se autocontiene y se puede dropear junto a cualquier task completada.

6. **Tests**: unit tests del contrato con Hardhat (`onlyOwner` previene un non-owner, `mint` actualiza balance), y un test de integración del route con un nodo Hardhat embebido en un test runner.

7. **Observabilidad blockchain**: agregar al `logger` el `blockNumber` y `gasUsed` del receipt para poder auditar costos y latencia. En producción con red real esto sería clave.

8. **Seguridad de keys**: la `OWNER_PRIVATE_KEY` en `.env.local` está bien para desarrollo local con Hardhat. En staging/producción la movería a un KMS (AWS KMS, GCP Secret Manager) o un signer remoto tipo Fireblocks/Defender Relay, nunca como variable de entorno en el servidor.

---

## 🛠️ Stack utilizado

- **Smart contract**: Solidity ^0.8.20, OpenZeppelin Contracts v5
- **Blockchain dev**: Hardhat con nodo local
- **Backend**: Next.js 15 (App Router), ethers.js v6
- **Database**: Supabase (PostgreSQL gestionado)
- **Auth**: patrón existente del codebase (`requireAuthAndPermission` con cookies parseadas del request)
- **Logging**: logger del codebase (`@/lib/debug-logger`)

---

**Autor**: Germán Rindizbacher  
**Contacto**: grindiz1989@gmail.com · GitHub: [gerindiz](https://github.com/gerindiz)

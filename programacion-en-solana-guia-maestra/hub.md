---
title: "programming in solana"
type: "hub"
hubId: "programacion-en-solana-guia-maestra"
goal: "Master programming in solana from scratch"
audience: "Intermediate Developers"
language: "Spanish"
date: "2026-02-04"
---

## Arquitectura de Solana para Desarrolladores Intermedios

> **TODO:** Explicar los conceptos de Proof of History (PoH), Tower BFT y el modelo de ejecución paralela (Sealevel). Enfocarse en cómo estas innovaciones diferencian a Solana de Ethereum desde una perspectiva técnica.

*Pending generation...*

## Dominando el Modelo de Cuentas y Propietarios

Para entender Solana, es imperativo abandonar la mentalidad de otros ecosistemas como Ethereum. En Solana, **todo es una cuenta**. Si los programas son el "código ejecutable", las cuentas son los "archivos" donde se almacena el estado.

### 1. Anatomía de una Cuenta
Cada cuenta en Solana reside en el almacenamiento global del clúster y posee una estructura de datos fija definida por el protocolo:

*   **Lamports**: El saldo en la unidad mínima de SOL.
*   **Owner**: La dirección del programa que tiene permiso para modificar los datos de la cuenta.
*   **Executable**: Un booleano que indica si la cuenta contiene código de programa.
*   **Data**: Un array de bytes que almacena el estado.
*   **Rent Epoch**: Información sobre el próximo ciclo de cobro de alquiler (actualmente obsoleto por el estado *rent-exempt*).

### 2. Tipos de Cuentas: Ejecutables vs. No Ejecutables

Podemos clasificar las cuentas en tres categorías principales según su función:

*   **Cuentas de Sistema (System Accounts):** Son las cuentas de usuario estándar (como las de tu wallet). Son propiedad del `System Program`. No son ejecutables y su función principal es transferir lamports o crear otras cuentas.
*   **Cuentas de Programa (Program Accounts):** Contienen código ejecutable que ha sido desplegado en la red. Tienen el flag `executable` en `true` y son propiedad del BPF Loader (el cargador de programas de Solana).
*   **Cuentas de Datos (Data Accounts):** Son creadas por programas para almacenar estado persistente (ej: el saldo de un token o los metadatos de un NFT). **Solo el programa propietario (Owner) puede modificar los datos de estas cuentas.**

### 3. El Concepto de Propiedad (Ownership) y Control
Este es el pilar de seguridad de Solana. Solo el programa identificado en el campo `Owner` de una cuenta tiene el privilegio de:
1.  **Reducir el saldo de lamports** de dicha cuenta.
2.  **Modificar los datos** del array `data`.

Cualquier programa puede leer los datos de cualquier cuenta y aumentar su saldo de lamports, pero solo el propietario puede escribir en ella. Esta distinción permite que Solana ejecute transacciones en paralelo de forma segura.

### 4. Gestión del Espacio y "Rent" (Alquiler)
Mantener datos en la memoria de los validadores de Solana no es gratuito. El concepto de **Rent** asegura que el espacio en disco se utilice de manera eficiente.

*   **Asignación de espacio:** El tamaño de una cuenta (en bytes) se define en el momento de su creación. Aunque es posible aumentar el tamaño de una cuenta mediante la instrucción `realloc`, esto requiere el pago de lamports adicionales.
*   **Exención de Alquiler (Rent-Exempt):** Actualmente, Solana requiere que todas las cuentas nuevas mantengan un saldo mínimo de lamports proporcional a su tamaño en bytes. Si una cuenta tiene suficientes lamports para cubrir aproximadamente 2 años de alquiler, se considera "exenta de alquiler" y no se le deducen fondos periódicamente.
*   **Recuperación de Fondos:** Si una cuenta ya no es necesaria, un programa puede cerrarla, vaciar sus datos y transferir los lamports restantes a otra dirección, liberando el espacio en el clúster.

### 5. Cuentas Derivadas de Programas (PDA)
Las **Program Derived Addresses (PDA)** son cuentas especiales que no tienen una clave privada asociada. Son fundamentales para que los programas puedan "firmar" instrucciones y gestionar activos de forma programática. Se derivan a partir de la dirección del programa y una combinación de "seeds" (semillas), permitiendo que el programa actúe como autoridad soberana sobre ellas.

```rust
// Ejemplo conceptual de la estructura de una cuenta en el SDK de Solana
pub struct AccountInfo<'a> {
    pub key: &'a Pubkey,          // Dirección de la cuenta
    pub is_signer: bool,          // ¿Firmó el dueño la transacción?
    pub is_writable: bool,        // ¿Se puede modificar esta cuenta?
    pub lamports: Rc<RefCell<&'a mut u64>>, // Saldo
    pub data: Rc<RefCell<&'a mut [u8]>>,    // Datos almacenados
    pub owner: &'a Pubkey,        // Programa propietario
    pub executable: bool,         // ¿Es un programa ejecutable?
    pub rent_epoch: Epoch,        // Época de alquiler
}
```

Dominar este modelo es el primer paso para diseñar arquitecturas eficientes. La separación estricta entre **lógica (programas)** y **estado (cuentas de datos)** es lo que otorga a Solana su capacidad de escalabilidad masiva.

## Configuración del Toolchain: Rust, Solana CLI y Anchor

Para construir aplicaciones descentralizadas (dApps) y programas en Solana, es imprescindible contar con un entorno de desarrollo optimizado. A continuación, se detalla el proceso de instalación del *toolchain* fundamental en sistemas basados en Unix (Linux/macOS) o WSL2 para Windows.

### 1. Instalación de Rust
Rust es el lenguaje principal para escribir programas en Solana. La forma recomendada de instalarlo es a través de `rustup`, que gestiona las versiones del compilador.

Ejecute el siguiente comando en su terminal:
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```
Una vez finalizada la instalación, actualice su entorno actual:
```bash
source $HOME/.cargo/env
```
**Verificación:**
```bash
rustc --version
```

### 2. Instalación de Solana CLI
La interfaz de línea de comandos de Solana permite interactuar con los clusters, gestionar claves criptográficas y desplegar programas.

Instale el conjunto de herramientas estable más reciente:
```bash
sh -c "$(curl -sSfL https://release.solana.com/stable/install)"
```
Si el comando no actualiza automáticamente su `PATH`, añada la siguiente línea a su archivo de configuración del shell (`.bashrc` o `.zshrc`):
```bash
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"
```

**Configuración inicial:**
Cree un par de llaves para desarrollo local y configure el CLI para apuntar al cluster de pruebas local (*localhost*):
```bash
solana-keygen new
solana config set --url localhost
```

### 3. Instalación de Anchor Framework
Anchor es el framework esencial para el desarrollo de *Smart Contracts* en Solana, proporcionando herramientas para la gestión de cuentas, serialización de datos y seguridad.

#### Dependencias previas
Anchor requiere **Node.js** (v16 o superior) y **Yarn**. Instálelos utilizando su gestor de paquetes preferido (ej. `nvm`).

#### Anchor Version Manager (AVM)
La mejor práctica es instalar `avm` para gestionar múltiples versiones de Anchor según las necesidades de cada proyecto:

```bash
cargo install --git https://github.com/coral-xyz/anchor avm --locked --force
```

Luego, instale y configure la versión más reciente:
```bash
avm install latest
avm use latest
```

### 4. Dependencias del Sistema (Linux)
En entornos Linux, asegúrese de tener instaladas las bibliotecas de desarrollo necesarias para la compilación de paquetes:
```bash
sudo apt-get update && sudo apt-get install -y \
    build-essential \
    pkg-config \
    libudev-dev \
    llvm \
    libclang-dev \
    protobuf-compiler \
    libssl-dev
```

### 5. Verificación del Entorno
Para asegurar que todo el stack está correctamente configurado, ejecute:

*   **Rust**: `rustc --version`
*   **Solana**: `solana --version`
*   **Anchor**: `anchor --version`

Si todos los comandos devuelven una versión válida, su entorno está listo para compilar y desplegar programas en Solana.

## Desarrollo de Programas con Anchor Framework

Anchor es el framework de desarrollo más utilizado en Solana, diseñado para abstraer la complejidad del desarrollo en Rust nativo (vanilla). Su principal ventaja es que reduce drásticamente la cantidad de código repetitivo (*boilerplate*) y minimiza los errores comunes de seguridad.

### 1. Estructura Fundamental de un Programa
Un programa en Anchor se divide en tres componentes lógicos principales:

#### A. Identificador del Programa (`declare_id!`)
Ubicada al inicio del archivo, esta macro define la dirección pública (Public Key) del programa en la red.
```rust
declare_id!("TuDireccionDeProgramaAqui111111111111111");
```

#### B. El Módulo de Instrucciones (`#[program]`)
Aquí se define la lógica de negocio. Cada función dentro de este módulo representa un *entrypoint* que los usuarios pueden invocar.
*   **Contexto**: Cada función recibe un `Context<T>`, donde `T` es una estructura que define las cuentas requeridas.
*   **Result**: Las funciones retornan un `Result<()>`, facilitando el manejo de errores.

```rust
#[program]
pub mod mi_programa {
    use super::*;

    pub fn inicializar_contador(ctx: Context<Inicializar>, valor: u64) -> Result<()> {
        let contador = &mut ctx.accounts.contador;
        contador.valor = valor;
        Ok(())
    }
}
```

#### C. Validación de Cuentas (`#[derive(Accounts)]`)
Esta es la capa de seguridad de Anchor. En lugar de validar manualmente cada cuenta (verificar si es firmante, si es el dueño, etc.), se utiliza una estructura con macros decoradoras.
*   **Constraint Checks**: Puedes usar atributos como `#[account(mut)]` para marcar cuentas editables, o `#[account(init, payer = user, space = 8 + 8)]` para crear cuentas automáticamente.

```rust
#[derive(Accounts)]
pub struct Inicializar<'info> {
    #[account(init, payer = usuario, space = 8 + 8)]
    pub contador: Account<'info, Contador>,
    #[account(mut)]
    pub usuario: Signer<'info>,
    pub system_program: Program<'info, System>,
}
```

### 2. Macros y el "Poder" de Anchor
Anchor utiliza macros de Rust para inyectar código de seguridad de forma transparente:

*   **`#[account]`**: Se aplica a las estructuras que definen los datos almacenados en una cuenta. Al usarla, Anchor implementa automáticamente la serialización y deserialización.
*   **`#[derive(Accounts)]`**: Realiza comprobaciones de seguridad críticas en tiempo de ejecución, como verificar que el programa sea el dueño de la cuenta o que los firmantes sean válidos.

### 3. Serialización con Borsh
Solana procesa los datos como arreglos de bytes crudos (`u8`). Para que nuestro programa pueda entenderlos, deben ser convertidos a estructuras de Rust. 

Anchor utiliza **Borsh** (Binary Object Representation Serializer for Hashing) para este proceso:
1.  **Eficiencia**: Borsh es extremadamente compacto, lo que reduce los costos de almacenamiento (rent) en la red.
2.  **Discriminadores**: Anchor añade un identificador de 8 bytes al inicio de cada cuenta basada en el nombre de su estructura. Esto evita ataques de "Account Substitution", donde un atacante intenta pasar una cuenta de un tipo por otra.

### 4. Seguridad por Defecto
El framework previene vulnerabilidades comunes mediante su sistema de tipos:
*   **Check de Propiedad**: Verifica automáticamente que las cuentas pasadas pertenezcan al programa.
*   **Signer Verification**: Asegura que las cuentas marcadas como `Signer` realmente hayan firmado la transacción.
*   **Reentrancy**: Al manejar el estado de forma atómica mediante el modelo de cuentas de Solana y la validación de Anchor, se mitigan riesgos de reentrada.

Mediante esta arquitectura, Anchor permite al desarrollador enfocarse en la **lógica de negocio**, mientras el framework garantiza que la interacción con el libro mayor de Solana sea segura y eficiente.

## PDAs (Program Derived Addresses) y Cross-Program Invocation (CPI)

Las **Program Derived Addresses (PDAs)** y la **Cross-Program Invocation (CPI)** son los pilares que permiten la composibilidad y la gestión de estado compleja en Solana. Comprender cómo interactúan es fundamental para desarrollar aplicaciones descentralizadas robustas.

### 1. Program Derived Addresses (PDAs)

Una PDA es una dirección que no posee una clave privada asociada. En su lugar, es "derivada" de una combinación de **semillas (seeds)** y el **ID de un programa**.

#### Características principales:
*   **Fuera de la curva (Off-curve):** Las PDAs son direcciones que no residen en la curva elíptica ed25519. Esto garantiza que nadie posea una clave privada capaz de firmar por esa dirección.
*   **Determinismo:** Siempre que uses las mismas semillas y el mismo Program ID, obtendrás la misma dirección. Esto permite que los programas localicen cuentas sin necesidad de almacenar sus direcciones en una base de datos externa.
*   **Autoridad de Firma:** Aunque no tienen clave privada, el programa del cual derivan la PDA puede "firmar" transacciones en su nombre utilizando el mecanismo de CPI.

#### Derivación de una PDA
Para encontrar una PDA, se utiliza la función `find_program_address`. El sistema añade un valor llamado **bump** (un número de 8 bits, empezando desde 255) para asegurar que la dirección resultante caiga fuera de la curva elíptica.

```rust
let (pda_pubkey, bump) = Pubkey::find_program_address(
    &[b"user_profile", user_authority.key().as_ref()],
    program_id
);
```

### 2. Cross-Program Invocation (CPI)

La CPI es el mecanismo que permite a un programa llamar a las instrucciones de otro programa. Esto es lo que permite que un programa interactúe, por ejemplo, con el System Program para crear cuentas o con el Token Program para transferir activos.

Existen dos funciones principales para ejecutar una CPI:

1.  **`invoke`**: Se utiliza cuando el programa que realiza la llamada no necesita firmar como una PDA. Solo propaga las firmas que ya están presentes en la transacción original.
2.  **`invoke_signed`**: Se utiliza cuando el programa necesita firmar en nombre de una PDA. Se deben proporcionar las semillas (incluyendo el bump) utilizadas para derivar la PDA.

### 3. El Programa como Firmante

Esta es la funcionalidad más crítica de las PDAs. Permite que los programas actúen como custodios de fondos o autoridades de cuentas de manera programática.

Cuando usas `invoke_signed`, el runtime de Solana verifica que las semillas proporcionadas generen la PDA que intenta firmar. Si coinciden, el runtime otorga privilegios de firma a esa dirección para esa instrucción específica.

#### Ejemplo: Transferencia de SOL desde una PDA
En este ejemplo (usando el framework Anchor), un programa firma una transferencia de SOL desde una cuenta propia hacia un usuario:

```rust
use anchor_lang::prelude::*;
use anchor_lang::solana_program::system_instruction;

pub fn withdraw_funds(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
    let seeds = &[
        b"vault".as_ref(),
        &[ctx.bumps.vault_pda], // El bump almacenado durante la creación
    ];
    let signer = &[&seeds[..]];

    let ix = system_instruction::transfer(
        &ctx.accounts.vault_pda.key(),
        &ctx.accounts.user.key(),
        amount,
    );

    // invoke_signed permite que la vault_pda "firme" la transferencia
    anchor_lang::solana_program::program::invoke_signed(
        &ix,
        &[
            ctx.accounts.vault_pda.to_account_info(),
            ctx.accounts.user.to_account_info(),
            ctx.accounts.system_program.to_account_info(),
        ],
        signer,
    )?;

    Ok(())
}
```

### Casos de Uso Comunes

*   **Cuentas de Almacenamiento (State Accounts):** Crear cuentas únicas para cada usuario (ej. `[b"profile", user_pubkey]`).
*   **Escrows (Fianzas):** Una PDA puede retener fondos o tokens de forma segura hasta que se cumplan ciertas condiciones lógicas programadas.
*   **Mints y Autoridades de Token:** Permitir que un programa sea el único capaz de acuñar (mint) nuevos tokens bajo reglas específicas.

### Resumen de Seguridad
*   **Validación de Semillas:** Siempre verifica que la PDA recibida en las cuentas coincida con la derivada por el programa para evitar ataques de inyección de cuentas.
*   **Bumps:** Se recomienda almacenar el bump en la cuenta PDA tras su creación para optimizar las llamadas a `invoke_signed` y evitar el cálculo redundante con `find_program_address`.

## Gestión de Tokens SPL y Estándares de Metadatos

En el ecosistema de Solana, la gestión de activos digitales se centraliza en el programa **SPL Token** (Solana Program Library). A diferencia de los modelos basados en contratos inteligentes individuales (como ERC-20), Solana utiliza un único programa genérico donde la lógica reside en el programa y el estado (saldos, autoridades) reside en cuentas de datos independientes.

### 1. Arquitectura de Tokens SPL (Fungibles)

Para trabajar con tokens fungibles, es fundamental entender la relación entre tres tipos de cuentas:

*   **Mint Account**: Define el token globalmente (suministro total, decimales y autoridades de acuñación/congelación). No almacena saldos.
*   **Token Account**: Almacena el saldo de un token específico para un propietario determinado.
*   **Associated Token Account (ATA)**: Una cuenta de token cuya dirección se deriva determinísticamente de la dirección del propietario y la dirección del Mint. Es el estándar para evitar la fragmentación de cuentas.

#### Flujo de trabajo con @solana/spl-token

Para crear y transferir tokens mediante código (Node.js/TypeScript):

```typescript
import { createMint, getOrCreateAssociatedTokenAccount, mintTo, transfer } from '@solana/spl-token';
import { Connection, Keypair, LAMPORTS_PER_SOL } from '@solana/web3.js';

// 1. Crear el Mint (La "fábrica" del token)
const mint = await createMint(
    connection,
    payer,          // Pagador de la transacción
    mintAuthority,  // Quién puede acuñar
    freezeAuthority,// Quién puede congelar cuentas
    9               // Decimales
);

// 2. Crear la Associated Token Account (ATA) para el receptor
const tokenAccount = await getOrCreateAssociatedTokenAccount(
    connection,
    payer,
    mint,
    payer.publicKey
);

// 3. Acuñar (Minting) tokens iniciales
await mintTo(
    connection,
    payer,
    mint,
    tokenAccount.address,
    mintAuthority,
    1000000000 // Cantidad en unidades mínimas
);
```

---

### 2. El Estándar de Metadatos de Metaplex

Por defecto, un token SPL solo posee un suministro y decimales. Para añadir nombre, símbolo e imagen, se utiliza el **Metaplex Token Metadata Program**. Este programa asocia una **PDA (Program Derived Address)** de metadatos a la cuenta Mint del token.

Los campos principales del estándar son:
*   **Name**: Nombre del activo (ej. "Solana Gold").
*   **Symbol**: Ticker (ej. "SLG").
*   **URI**: Enlace a un archivo JSON externo (alojado en IPFS, Arweave o AWS) que contiene la imagen y atributos adicionales.

---

### 3. Creación de Non-Fungible Tokens (NFTs)

En Solana, un NFT es técnicamente un token SPL con:
1.  **Decimales: 0**.
2.  **Suministro: 1**.
3.  **Master Edition**: Una cuenta de Metaplex que garantiza la unicidad y controla las "impresiones" o copias.

#### Implementación con Metaplex Umi

La forma más eficiente de gestionar NFTs actualmente es mediante **Umi**, el framework modular de Metaplex:

```typescript
import { createNft } from '@metaplex-foundation/mpl-token-metadata';
import { percentAmount, generateSigner } from '@metaplex-foundation/umi';

const mint = generateSigner(umi);

await createNft(umi, {
    mint,
    name: "Mi Primer NFT",
    symbol: "MNFT",
    uri: "https://arweave.net/metadata.json",
    sellerFeeBasisPoints: percentAmount(5.5), // 5.5% de regalías
}).sendAndConfirm(umi);
```

---

### 4. Transferencias y Gestión de Cuentas

La transferencia de activos requiere que el receptor posea una cuenta de token (o ATA) compatible con el Mint que se envía.

*   **Transferencia Fungible**: Se mueven unidades de la cuenta origen a la cuenta destino.
*   **Transferencia NFT**: Se mueve la totalidad del suministro (1 unidad) de la cuenta origen a la cuenta destino.

**Comando CLI básico para transferencia:**
```bash
spl-token transfer <MINT_ADDRESS> <AMOUNT> <RECIPIENT_ADDRESS> --fund-recipient
```
*El flag `--fund-recipient` es crítico: si el receptor no tiene una ATA, la transacción creará una automáticamente, deduciendo los lamports del remitente para el alquiler (rent-exempt).*

### 5. Consideraciones de Seguridad y Autoridades

*   **Revocación de Autoridades**: Para tokens con suministro fijo o NFTs finalizados, es una buena práctica "renunciar" a la autoridad de acuñación (`mintAuthority`) estableciéndola en `null`. Esto genera confianza en los usuarios al garantizar que no se emitirán más tokens.
*   **Burn (Quema)**: El proceso de `burn` reduce el suministro circulante. A diferencia de cerrar la cuenta, la quema destruye los tokens pero mantiene la integridad de las cuentas si no se cierran explícitamente.

## Integración de Frontend con Solana Web3.js y Wallet Adapter

Para construir una interfaz funcional en Solana, la arquitectura estándar se apoya en dos pilares: **Solana Web3.js** (la librería core para interactuar con RPCs) y **Solana Wallet Adapter** (una suite de librerías que estandariza la conexión con carteras como Phantom o Solflare).

### 1. Instalación de Dependencias

En un proyecto React o Next.js, instala los paquetes necesarios para gestionar la conexión y la interfaz de usuario:

```bash
npm install @solana/web3.js \
    @solana/wallet-adapter-base \
    @solana/wallet-adapter-react \
    @solana/wallet-adapter-react-ui \
    @solana/wallet-adapter-wallets
```

### 2. Configuración de los Providers

Para que el estado de la cartera esté disponible en toda la aplicación, debes envolver tus componentes en una jerarquía de *Providers*. Estos gestionan la conexión al cluster (Mainnet, Devnet) y el ciclo de vida de la billetera.

```tsx
import React, { useMemo } from 'react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { clusterApiUrl } from '@solana/web3.js';
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';

// Importar estilos CSS por defecto
require('@solana/wallet-adapter-react-ui/styles.css');

export const WalletContextProvider = ({ children }) => {
    // Definir el cluster (Devnet para desarrollo)
    const endpoint = useMemo(() => clusterApiUrl('devnet'), []);

    // Configurar los adaptadores de carteras soportadas
    const wallets = useMemo(() => [
        new PhantomWalletAdapter(),
        new SolflareWalletAdapter(),
    ], []);

    return (
        <ConnectionProvider endpoint={endpoint}>
            <WalletProvider wallets={wallets} autoConnect>
                <WalletModalProvider>
                    {children}
                </WalletModalProvider>
            </WalletProvider>
        </ConnectionProvider>
    );
};
```

### 3. Implementación del Botón de Conexión

El paquete `@solana/wallet-adapter-react-ui` incluye componentes pre-construidos para gestionar la selección de carteras.

```tsx
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';

const Navbar = () => {
    return (
        <nav>
            <h1>Mi dApp de Solana</h1>
            <WalletMultiButton />
        </nav>
    );
};
```

### 4. Acceso al Estado y Envío de Transacciones

Para interactuar con la blockchain, utilizaremos los hooks `useConnection` (para obtener el objeto de conexión RPC) y `useWallet` (para obtener la clave pública del usuario y las funciones de firma).

#### Ejemplo: Envío de SOL

A continuación, se muestra cómo construir, firmar y enviar una transacción de transferencia básica:

```tsx
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { Transaction, SystemProgram, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';

export const SendSolComponent = () => {
    const { connection } = useConnection();
    const { publicKey, sendTransaction } = useWallet();

    const handleSend = async () => {
        if (!publicKey) return alert("¡Cartera no conectada!");

        try {
            // 1. Crear la transacción
            const transaction = new Transaction().add(
                SystemProgram.transfer({
                    fromPubkey: publicKey,
                    toPubkey: new PublicKey('RECIPIENT_PUBLIC_KEY'),
                    lamports: 0.1 * LAMPORTS_PER_SOL,
                })
            );

            // 2. Obtener el blockhash más reciente
            const { context: { slot: minContextSlot }, value: { blockhash, lastValidBlockHeight } } = 
                await connection.getLatestBlockhashAndContext();

            // 3. Enviar y solicitar la firma al usuario
            const signature = await sendTransaction(transaction, connection, { minContextSlot });

            // 4. Confirmar la transacción
            await connection.confirmTransaction({ blockhash, lastValidBlockHeight, signature });
            
            console.log("Transacción exitosa:", signature);
        } catch (error) {
            console.error("Error en la transacción:", error);
        }
    };

    return (
        <button onClick={handleSend} disabled={!publicKey}>
            Enviar 0.1 SOL
        </button>
    );
};
```

### Conceptos Clave para el Frontend

*   **`publicKey`**: Representa la dirección de la billetera conectada. Si es `null`, el usuario no ha autenticado su cartera.
*   **`sendTransaction`**: Este método es fundamental. Se encarga de enviar la transacción al adaptador de la cartera para que el usuario la firme mediante una ventana emergente y luego la propaga a la red.
*   **Gestión de Compromiso (Commitment)**: Al realizar consultas o confirmar transacciones, puedes especificar el nivel de seguridad (`processed`, `confirmed`, `finalized`). Para aplicaciones interactivas, `confirmed` suele ser el equilibrio ideal entre velocidad y seguridad.
*   **Manejo de Errores**: Siempre envuelve las llamadas a `sendTransaction` en bloques `try/catch`, ya que el usuario puede rechazar la firma o la transacción puede fallar por falta de fondos.

## Seguridad en Programas de Solana y Mejores Prácticas

La seguridad en el desarrollo de programas de Solana difiere significativamente de los entornos EVM debido a su arquitectura de procesamiento paralelo y su modelo de cuentas. A continuación, se detallan las vulnerabilidades más críticas y las prácticas recomendadas para mitigarlas.

### 1. Validación de Cuentas (Missing Account Checks)

En Solana, los programas no almacenan datos internamente; estos residen en cuentas externas que se pasan a la instrucción. Un atacante puede pasar cuentas maliciosas en lugar de las esperadas.

*   **Vulnerabilidad**: No verificar que una cuenta de datos pertenece realmente al programa o al usuario esperado.
*   **Mitigación**: Siempre se debe validar el `owner` de la cuenta y, si es necesario, su dirección específica (clave pública).

```rust
// Vulnerable: No verifica quién es el dueño de la cuenta
if account_info.owner != program_id {
    return Err(ProgramError::IllegalOwner.into());
}
```

### 2. Validación de Firmas (Signer Checks)

Cualquier instrucción que realice una acción privilegiada (como transferir fondos o cambiar autoridad) debe verificar que la autoridad necesaria haya firmado la transacción.

*   **Vulnerabilidad**: Permitir que un usuario ejecute una función que afecta a la cuenta de otro sin su permiso.
*   **Mitigación**: Usar el campo `is_signer`.

```rust
if !authority_info.is_signer {
    return Err(ProgramError::MissingRequiredSignature.into());
}
```

### 3. Desbordamientos de Enteros (Arithmetic Overflows)

Aunque Rust previene desbordamientos en modo `debug`, en modo `release` (usado en mainnet) los cálculos aritméticos estándar pueden envolverse (wrap around), causando comportamientos inesperados en balances y lógica de tokens.

*   **Vulnerabilidad**: Un usuario podría manipular un balance para que pase de 0 a un valor máximo.
*   **Mitigación**: Utilizar siempre métodos aritméticos seguros como `checked_add`, `checked_sub`, `checked_mul` y `checked_div`.

```rust
let new_balance = user_account.balance
    .checked_add(deposit_amount)
    .ok_or(ErrorCode::Overflow)?;
```

### 4. Re-entrancy en Solana

A diferencia de Ethereum, Solana no permite llamadas recursivas directas que re-entren en el mismo estado de la instrucción actual de la misma manera, debido a que el modelo de cuentas bloquea el acceso durante la ejecución. Sin embargo, puede ocurrir una forma de re-entrancy a través de **Cross-Program Invocations (CPI)** si un programa llama a otro y este último vuelve a llamar al original para intentar modificar un estado que aún no se ha actualizado.

*   **Mejor Práctica**: Seguir el patrón de **"Verificar-Actualizar-Interactuar"**. Primero valida las condiciones, luego actualiza el estado interno del programa y, finalmente, realiza llamadas externas (CPI).

### 5. Type Cosplay (Suplantación de Tipo)

Solana ve las cuentas como simples arreglos de bytes. Si un programa maneja múltiples tipos de cuentas (ej. `UserAccount` y `AdminConfig`), un atacante podría pasar una cuenta de tipo `UserAccount` donde se espera una `AdminConfig`.

*   **Mitigación**: Implementar un discriminador único (un prefijo de bytes) al inicio de cada cuenta para identificar su tipo. El framework **Anchor** hace esto automáticamente.

### Herramientas de Auditoría y Seguridad

Para robustecer el ciclo de desarrollo, se recomienda integrar las siguientes herramientas:

1.  **Anchor Framework**: Es la herramienta de seguridad más potente. Implementa automáticamente validaciones de firmas, propietarios y discriminadores de cuenta mediante macros de Rust (`#[derive(Accounts)]`).
2.  **Soteria**: Una herramienta de análisis estático diseñada específicamente para buscar vulnerabilidades comunes en programas de Solana.
3.  **Lighthouse**: Un protocolo de verificación de estado que permite añadir aserciones a las transacciones para asegurar que las cuentas cumplan con ciertos criterios antes de ejecutar la lógica.
4.  **Trident**: Un framework de *fuzz testing* para Solana que ayuda a encontrar casos de borde mediante la generación de entradas aleatorias y pruebas de propiedad.

### Resumen de Mejores Prácticas
- **Usar Anchor**: Reduce drásticamente el error humano al manejar el boilerplate de seguridad.
- **Cuentas de solo lectura**: Si una cuenta no necesita ser modificada, márcala como tal para permitir una mayor paralelización y seguridad.
- **Validación de PDAs**: Cuando uses Program Derived Addresses, verifica siempre que la dirección generada coincida con la proporcionada usando `Pubkey::create_program_address`.

## Optimización de Unidades de Cómputo y Costos

> **TODO:** Explicar el límite de unidades de cómputo por transacción y cómo optimizar el código Rust para reducir el consumo, mejorando la escalabilidad y reduciendo fallos en transacciones complejas.

*Pending generation...*

## Estrategias de Testing y Despliegue en Mainnet

> **TODO:** Guía sobre el uso de bancos de pruebas locales (solana-test-validator), tests de integración en TypeScript y el proceso de despliegue final en la red principal (Mainnet-Beta).

*Pending generation...*

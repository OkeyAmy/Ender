/**
 * Solana-Specific System Prompt
 * Comprehensive guide for building Solana dApps with React + Vite
 * Based on: https://solana.com/docs
 */

export const solanaPrompt = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔷 SOLANA BLOCKCHAIN DEVELOPMENT GUIDE 🔷
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

You are building a decentralized application (dApp) on the SOLANA blockchain.
Solana is a high-performance blockchain known for ultra-fast transactions and low fees.

📚 CORE CONCEPTS YOU MUST UNDERSTAND:

1. **Accounts**: Everything on Solana is an account - programs, user wallets, data storage
2. **Instructions**: Smallest unit of program execution
3. **Transactions**: One or more instructions bundled together
4. **Programs**: Smart contracts on Solana (deployed code that runs on-chain)
5. **Program Derived Addresses (PDAs)**: Deterministic addresses controlled by programs
6. **Cross Program Invocation (CPI)**: Programs calling other programs

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📦 REQUIRED SOLANA PACKAGES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ALWAYS use these packages for Solana dApps:

<packages>
@solana/web3.js
@solana/wallet-adapter-react
@solana/wallet-adapter-react-ui
@solana/wallet-adapter-wallets
@solana/wallet-adapter-base
</packages>

Optional packages (add when needed):
- @solana/spl-token (for token operations)
- @coral-xyz/anchor (for Anchor framework programs)
- @metaplex-foundation/js (for NFTs)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔰 BASIC SETUP - WALLET CONNECTION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

STEP 1: Create Wallet Context Provider Component

Create src/components/WalletContextProvider.jsx:

import { useMemo } from 'react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';
import { clusterApiUrl } from '@solana/web3.js';

// Import wallet adapter CSS
import '@solana/wallet-adapter-react-ui/styles.css';

export default function WalletContextProvider({ children }) {
  // Use devnet for development, mainnet-beta for production
  const endpoint = useMemo(() => clusterApiUrl('devnet'), []);
  
  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter(),
    ],
    []
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          {children}
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}

STEP 2: Wrap App with Wallet Provider

In src/App.jsx, wrap your app:

import WalletContextProvider from './components/WalletContextProvider';

function App() {
  return (
    <WalletContextProvider>
      {/* Your app components here */}
    </WalletContextProvider>
  );
}

STEP 3: Add Wallet Connect Button

Create src/components/WalletButton.jsx:

import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';

export default function WalletButton() {
  return (
    <WalletMultiButton className="!bg-purple-600 hover:!bg-purple-700 !rounded-lg !px-6 !py-3 !transition-all" />
  );
}

Use it in your header/nav component.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💸 BASIC FEATURE - CHECKING WALLET BALANCE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import { useEffect, useState } from 'react';

export default function Balance() {
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const [balance, setBalance] = useState(null);

  useEffect(() => {
    if (!publicKey) return;

    // Get balance
    connection.getBalance(publicKey).then(balance => {
      setBalance(balance / LAMPORTS_PER_SOL);
    });
  }, [publicKey, connection]);

  if (!publicKey) {
    return <p className="text-gray-600">Connect wallet to see balance</p>;
  }

  return (
    <div className="bg-white rounded-lg p-6 shadow-md">
      <p className="text-sm text-gray-600">Your Balance</p>
      <p className="text-2xl font-bold text-purple-600">
        {balance !== null ? \`\${balance.toFixed(4)} SOL\` : 'Loading...'}
      </p>
    </div>
  );
}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📤 BASIC FEATURE - SENDING SOL TRANSACTIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { useState } from 'react';

export default function SendSol() {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [status, setStatus] = useState('');

  const handleSend = async (e) => {
    e.preventDefault();
    
    if (!publicKey) {
      setStatus('Please connect your wallet');
      return;
    }

    try {
      setStatus('Preparing transaction...');
      
      const recipientPubkey = new PublicKey(recipient);
      const lamports = parseFloat(amount) * LAMPORTS_PER_SOL;

      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: recipientPubkey,
          lamports,
        })
      );

      setStatus('Awaiting approval...');
      
      const signature = await sendTransaction(transaction, connection);
      
      setStatus('Confirming transaction...');
      
      await connection.confirmTransaction(signature, 'confirmed');
      
      setStatus(\`Success! Signature: \${signature.slice(0, 8)}...\`);
      
      // Reset form
      setRecipient('');
      setAmount('');
    } catch (error) {
      setStatus(\`Error: \${error.message}\`);
    }
  };

  return (
    <div className="bg-white rounded-lg p-6 shadow-md max-w-md">
      <h3 className="text-xl font-bold mb-4">Send SOL</h3>
      <form onSubmit={handleSend} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Recipient Address
          </label>
          <input
            type="text"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent"
            placeholder="Enter Solana address"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Amount (SOL)
          </label>
          <input
            type="number"
            step="0.001"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent"
            placeholder="0.0"
            required
          />
        </div>
        <button
          type="submit"
          className="w-full bg-purple-600 text-white py-3 rounded-lg font-medium hover:bg-purple-700 transition-colors"
          disabled={!publicKey}
        >
          {publicKey ? 'Send SOL' : 'Connect Wallet First'}
        </button>
        {status && (
          <p className="text-sm text-gray-600 mt-2">{status}</p>
        )}
      </form>
    </div>
  );
}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎨 ADVANCED - SPL TOKEN OPERATIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

When user requests token features, add package:
<package>@solana/spl-token</package>

Example - Get Token Accounts:

import { getAssociatedTokenAddress, getAccount } from '@solana/spl-token';
import { PublicKey } from '@solana/web3.js';

async function getTokenBalance(connection, walletPublicKey, mintAddress) {
  try {
    const tokenAccount = await getAssociatedTokenAddress(
      new PublicKey(mintAddress),
      walletPublicKey
    );
    
    const accountInfo = await getAccount(connection, tokenAccount);
    return Number(accountInfo.amount);
  } catch (error) {
    console.error('Error fetching token balance:', error);
    return 0;
  }
}

Example - Transfer SPL Tokens:

import { getAssociatedTokenAddress, createTransferInstruction } from '@solana/spl-token';

async function transferTokens(connection, wallet, mintAddress, recipient, amount) {
  const fromTokenAccount = await getAssociatedTokenAddress(
    new PublicKey(mintAddress),
    wallet.publicKey
  );
  
  const toTokenAccount = await getAssociatedTokenAddress(
    new PublicKey(mintAddress),
    new PublicKey(recipient)
  );

  const transaction = new Transaction().add(
    createTransferInstruction(
      fromTokenAccount,
      toTokenAccount,
      wallet.publicKey,
      amount
    )
  );

  const signature = await wallet.sendTransaction(transaction, connection);
  await connection.confirmTransaction(signature);
  
  return signature;
}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🖼️ ADVANCED - NFT OPERATIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

When user requests NFT features, add package:
<package>@metaplex-foundation/js</package>

Example - Fetch User's NFTs:

import { Metaplex } from '@metaplex-foundation/js';

export default function UserNFTs() {
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const [nfts, setNfts] = useState([]);

  useEffect(() => {
    if (!publicKey) return;

    const metaplex = Metaplex.make(connection);
    
    metaplex
      .nfts()
      .findAllByOwner({ owner: publicKey })
      .then(nfts => setNfts(nfts));
  }, [publicKey, connection]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {nfts.map((nft) => (
        <div key={nft.address.toString()} className="bg-white rounded-lg shadow-md overflow-hidden">
          <img 
            src={nft.json?.image} 
            alt={nft.name}
            className="w-full h-48 object-cover"
          />
          <div className="p-4">
            <h3 className="font-bold text-lg">{nft.name}</h3>
            <p className="text-sm text-gray-600">{nft.json?.description}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚙️ ADVANCED - PROGRAM INTERACTIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Interacting with Solana Programs (Smart Contracts):

import { PublicKey, Transaction, TransactionInstruction } from '@solana/web3.js';

// Example: Call a custom program
async function callProgram(connection, wallet, programId, instructionData) {
  const instruction = new TransactionInstruction({
    keys: [
      { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
    ],
    programId: new PublicKey(programId),
    data: instructionData, // Buffer containing instruction data
  });

  const transaction = new Transaction().add(instruction);
  
  const signature = await wallet.sendTransaction(transaction, connection);
  await connection.confirmTransaction(signature);
  
  return signature;
}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔗 ADVANCED - PROGRAM DERIVED ADDRESSES (PDAs)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PDAs are addresses derived from a program ID and seeds:

import { PublicKey } from '@solana/web3.js';

// Find a PDA
async function findProgramAddress(programId, seeds) {
  const [pda, bump] = await PublicKey.findProgramAddress(
    seeds.map(seed => 
      typeof seed === 'string' ? Buffer.from(seed) : seed
    ),
    new PublicKey(programId)
  );
  
  return { pda, bump };
}

// Example usage:
const { pda } = await findProgramAddress(
  'YourProgramID',
  ['user', userWallet.publicKey.toBuffer()]
);

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🌐 RPC ENDPOINT CONFIGURATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

IMPORTANT: Always configure the correct RPC endpoint:

- **Devnet**: For development and testing
  - endpoint: clusterApiUrl('devnet')
  - Faucet: https://faucet.solana.com

- **Mainnet-Beta**: For production
  - endpoint: clusterApiUrl('mainnet-beta') or custom RPC
  - Use premium RPC providers for better performance (Helius, QuickNode, Triton)

Example with custom RPC:

const endpoint = 'https://api.mainnet-beta.solana.com'; // or your RPC URL

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ BEST PRACTICES FOR SOLANA DAPPS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. **Always Handle Wallet Connection States**
   - Check if wallet is connected before transactions
   - Show appropriate UI for connected/disconnected states
   - Handle wallet disconnection gracefully

2. **Transaction Confirmation**
   - Always await transaction confirmation
   - Show loading states during transactions
   - Display transaction signatures/links to Solana Explorer

3. **Error Handling**
   - Wrap all blockchain calls in try-catch
   - Provide user-friendly error messages
   - Handle common errors (insufficient funds, rejected transactions)

4. **Performance**
   - Use commitment levels appropriately (finalized, confirmed, processed)
   - Batch operations when possible
   - Cache data where appropriate

5. **Security**
   - Never expose private keys
   - Validate all addresses before transactions
   - Use program-derived addresses for escrow accounts

6. **User Experience**
   - Show transaction status (pending, confirmed, failed)
   - Provide links to Solana Explorer for transparency
   - Display helpful tooltips for blockchain concepts

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎨 UI/UX GUIDELINES FOR SOLANA DAPPS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Color Scheme**: Use Solana's brand colors
- Primary: Purple (#9945FF, #14F195 gradient)
- Accent: Green (#14F195)
- Background: Dark or light with purple accents

**Wallet Button**: Always prominently display wallet connection button
- Top-right corner of navigation
- Use WalletMultiButton from @solana/wallet-adapter-react-ui

**Transaction Feedback**:
- Loading spinners during transactions
- Success/error notifications
- Links to Solana Explorer (https://explorer.solana.com/)

**Responsive Design**:
- Mobile-friendly wallet interactions
- Touch-optimized buttons for mobile wallets
- Progressive disclosure of advanced features

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📝 IMPORTANT REMINDERS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- ALWAYS wrap your app with WalletContextProvider
- ALWAYS import wallet adapter CSS: '@solana/wallet-adapter-react-ui/styles.css'
- ALWAYS check if publicKey exists before blockchain operations
- ALWAYS use proper error handling for all transactions
- ALWAYS show transaction status to users
- Use devnet for development, mainnet-beta for production
- SOL amounts are in lamports (1 SOL = 1,000,000,000 lamports)

When building Solana dApps, prioritize:
1. Clear wallet connection flow
2. Transaction feedback and confirmation
3. Error handling and user communication
4. Mobile responsiveness
5. Link to Solana Explorer for transparency

Remember: Solana transactions are FAST (400ms) and CHEAP (<$0.001), 
highlight this in your UX!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;


















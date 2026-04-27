import gameAbi from "../abi/LumentGame.json";
import usdcAbi from "../abi/MockUSDC.json";

export const GAME_ADDRESS = (process.env.NEXT_PUBLIC_GAME_ADDRESS ||
  "0xFb85B47485d17C74F7f9B4AF1bF489CBeD9685C7") as `0x${string}`;

export const USDC_ADDRESS = (process.env.NEXT_PUBLIC_USDC_ADDRESS ||
  "0xe1708F67a6D58650a494aA1898043E9E06b512C3") as `0x${string}`;

export { gameAbi, usdcAbi };

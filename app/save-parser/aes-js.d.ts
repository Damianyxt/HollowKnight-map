declare module "aes-js" {
  const aesjs: {
    ModeOfOperation: {
      ecb: new (key: number[]) => { decrypt(bytes: number[]): number[] };
    };
  };
  export default aesjs;
}

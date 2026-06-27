import hre from "hardhat";

async function main() {
  console.log("Desplegando WorkloToken...");

  const WorkloToken = await hre.ethers.getContractFactory("WorkloToken");
  const token = await WorkloToken.deploy();

  await token.waitForDeployment();

  const tokenAddress = await token.getAddress();
  console.log(`¡Contrato desplegado con éxito!`);
  console.log(`Dirección del Token (WPT): ${tokenAddress}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
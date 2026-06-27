// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract WorkloToken is ERC20, Ownable {
    
    // Pasamos el nombre y el símbolo del token al constructor de ERC20
    // Y el msg.sender inicial al constructor de Ownable
    constructor() ERC20("Worklo Platform Token", "WPT") Ownable(msg.sender) {}

    /**
     * @dev Función para emitir nuevos tokens. 
     * Solo el propietario (owner) del contrato puede llamarla.
     * @param to Dirección que recibirá los tokens.
     * @param amount Cantidad de tokens a emitir (en wei).
     */
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
}
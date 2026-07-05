// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {FHE, euint64} from "@fhevm/solidity/lib/FHE.sol";
import {ERC7984} from "@openzeppelin/confidential-contracts/token/ERC7984/ERC7984.sol";

/// @title DemoConfidentialToken — an ERC-7984 confidential token for CLOISTRA demos.
/// @notice UNAUDITED DEMONSTRATION ONLY. This is a plain confidential fungible token
///         (ERC-7984) with an open `mint` so the demo principal can fund a mandate's
///         custody. It carries none of CLOISTRA's sealed-mandate logic — that lives in
///         `Cloistra.sol`. In production this would be a real cToken (e.g. cUSDT) from
///         the Zama testnet registry; nothing in the engine depends on this mock.
contract DemoConfidentialToken is ERC7984, ZamaEthereumConfig {
    constructor(string memory name_, string memory symbol_, string memory tokenURI_)
        ERC7984(name_, symbol_, tokenURI_)
    {}

    /// @notice Mint `amount` confidential units to `to`. Demo convenience only.
    /// @dev The minted handle is granted to `to` and this contract by `_update` internally.
    function mint(address to, uint64 amount) external returns (euint64) {
        return _mint(to, FHE.asEuint64(amount));
    }
}

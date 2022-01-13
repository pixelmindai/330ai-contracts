// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

import "@openzeppelin/contracts/utils/math/SafeMath.sol";

library Convert {
    function etherToWei(uint256 valueEther) internal pure returns (uint256) {
        return SafeMath.mul(valueEther, 1e18);
    }
}

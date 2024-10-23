// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/metatx/ERC2771Forwarder.sol";

contract StableForwarder is ERC2771Forwarder {
    constructor() payable ERC2771Forwarder("StableForwarder") {}

    function forwardDataTypehash() external pure returns(bytes32){
        return _FORWARD_REQUEST_TYPEHASH;
    }

    receive() external payable {}
    
}

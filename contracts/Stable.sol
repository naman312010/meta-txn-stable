// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/metatx/ERC2771Context.sol";

contract Stable is ERC20,ERC2771Context {
    address public owner;

    modifier onlyOwner(){
        require(_msgSender() == owner);
        _;
    }

    constructor(string memory _name, string memory _symbol, address _trustedForwarder) 
    ERC20(_name,_symbol)
    ERC2771Context(_trustedForwarder) {
        owner = msg.sender;
    }

    function mint(address _recipient, uint256 _amount) public onlyOwner{
        _mint(_recipient,_amount);
    }

    function burnOther(address _recipient, uint256 _amount) public onlyOwner{
        _burn(_recipient,_amount);
    }

    function _contextSuffixLength() internal view virtual override(ERC2771Context,Context) returns(uint256) {
        return super._contextSuffixLength();
    }

    function _msgData() internal view virtual override(ERC2771Context,Context) returns (bytes calldata) {
        return super._msgData();
    }

    function _msgSender() internal view virtual override(ERC2771Context,Context) returns (address) {
        return super._msgSender();
    }
}

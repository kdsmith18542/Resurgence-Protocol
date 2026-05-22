// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract MockOracle {
    int256 public answer;
    uint8 public decimals;
    uint256 public updatedAt;

    constructor(int256 _initialAnswer, uint8 _decimals) {
        answer = _initialAnswer;
        decimals = _decimals;
        updatedAt = block.timestamp;
    }

    function setPrice(int256 _newAnswer, uint8 _decimals) external {
        answer = _newAnswer;
        decimals = _decimals;
        updatedAt = block.timestamp;
    }

    function updateAnswer(int256 _newAnswer) external {
        answer = _newAnswer;
        updatedAt = block.timestamp;
    }

    function latestAnswer() external view returns (int256) {
        return answer;
    }

    function latestRoundData() external view returns (
        uint80 roundId,
        int256 _answer,
        uint256 startedAt,
        uint256 _updatedAt,
        uint80 answeredInRound
    ) {
        return (0, answer, 0, updatedAt, 0);
    }
}

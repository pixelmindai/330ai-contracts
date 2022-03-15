// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

import "@openzeppelin/contracts/proxy/beacon/UpgradeableBeacon.sol";
import "@openzeppelin/contracts/proxy/beacon/BeaconProxy.sol";

contract PixelmindSeriesMintingUpgradeableBeacon is UpgradeableBeacon {
    address[] private series;

    constructor(address _implementation) UpgradeableBeacon(_implementation) {}

    function newSeries(
        string memory name_,
        string memory symbol_,
        address admin_,
        address minter_,
        string memory baseTokenURI_
    ) public returns (address) {
        bytes memory data_ = abi.encodeWithSignature(
            "initialize(string,string,address,address,string)",
            name_,
            symbol_,
            admin_,
            minter_,
            baseTokenURI_
        );
        BeaconProxy seriesBeaconProxy = new BeaconProxy(address(this), data_);
        address seriesAddress = address(seriesBeaconProxy);
        series.push(seriesAddress);
        return seriesAddress;
    }

    function getSeriesAddresses() public view returns (address[] memory) {
        return series;
    }
}

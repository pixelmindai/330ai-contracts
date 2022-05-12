// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import "@openzeppelin/contracts/proxy/beacon/UpgradeableBeacon.sol";
import "@openzeppelin/contracts/proxy/beacon/BeaconProxy.sol";

contract PixelmindSeriesMintingUpgradeableBeacon is UpgradeableBeacon {
    mapping(bytes32 => address) public series;

    event NewSeriesCreated(bytes32 id, address series);

    constructor(address _implementation) UpgradeableBeacon(_implementation) {}

    function newSeries(
        bytes32 id_,
        string memory name_,
        string memory symbol_,
        address admin_,
        address minter_,
        string memory contractURI_,
        string memory baseTokenURI_
    ) public {
        bytes memory data_ = abi.encodeWithSignature(
            "initialize(string,string,address,address,string,string)",
            name_,
            symbol_,
            admin_,
            minter_,
            contractURI_,
            baseTokenURI_
        );
        BeaconProxy seriesBeaconProxy = new BeaconProxy(address(this), data_);
        address seriesAddress = address(seriesBeaconProxy);
        series[id_] = seriesAddress;
        emit NewSeriesCreated(id_, seriesAddress);
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Base64.sol";

/// @title SwarmitUsernameRegistry
/// @notice ERC-721 username registry for the Swarmit protocol.
/// @dev Usernames are transferable NFTs. Each address may designate one as its primary display name.
contract SwarmitUsernameRegistry is ERC721, Ownable, ReentrancyGuard {

    // ============================================
    // Events
    // ============================================

    event UsernameClaimed(address indexed owner, uint256 indexed tokenId, string name, uint256 pricePaid);
    event PrimaryNameSet(address indexed owner, uint256 indexed tokenId, string name);

    // ============================================
    // State
    // ============================================

    uint256 public immutable baseMintPrice;
    uint256 public immutable priceStep;
    uint256 private _nextTokenId = 1;

    mapping(bytes32 => uint256) public tokenIdByNameHash;
    mapping(uint256 => string) private _nameByTokenId;
    mapping(address => uint256) public primaryTokenOf;

    // ============================================
    // Constructor
    // ============================================

    constructor(
        uint256 _baseMintPrice,
        uint256 _priceStep,
        address _owner
    ) ERC721("Swarmit Username", "SWARMU") Ownable(_owner) {
        baseMintPrice = _baseMintPrice;
        priceStep = _priceStep;
    }

    // ============================================
    // Pricing
    // ============================================

    function currentMintPrice() public view returns (uint256) {
        return baseMintPrice + ((_nextTokenId - 1) * priceStep);
    }

    // ============================================
    // Name validation
    // ============================================

    function _validateName(string calldata name) internal pure {
        bytes memory b = bytes(name);
        uint256 len = b.length;
        require(len >= 3, "name too short");
        require(len <= 24, "name too long");

        bool prevHyphen = false;
        for (uint256 i = 0; i < len; i++) {
            bytes1 c = b[i];
            bool isLower = (c >= 0x61 && c <= 0x7A); // a-z
            bool isDigit = (c >= 0x30 && c <= 0x39); // 0-9
            bool isHyphen = (c == 0x2D);              // -

            require(isLower || isDigit || isHyphen, "invalid character");

            if (isHyphen) {
                require(i != 0, "leading hyphen");
                require(i != len - 1, "trailing hyphen");
                require(!prevHyphen, "consecutive hyphens");
                prevHyphen = true;
            } else {
                prevHyphen = false;
            }
        }
    }

    // ============================================
    // Query
    // ============================================

    function isAvailable(string calldata name) external view returns (bool) {
        bytes32 nameHash = keccak256(bytes(name));
        return tokenIdByNameHash[nameHash] == 0;
    }

    function primaryNameOf(address owner) external view returns (string memory) {
        uint256 tokenId = primaryTokenOf[owner];
        if (tokenId == 0) return "";
        return _nameByTokenId[tokenId];
    }

    function nameOfToken(uint256 tokenId) external view returns (string memory) {
        _requireOwned(tokenId);
        return _nameByTokenId[tokenId];
    }

    // ============================================
    // Claim
    // ============================================

    function claim(string calldata name, uint256 maxPrice) external payable nonReentrant returns (uint256 tokenId) {
        _validateName(name);

        bytes32 nameHash = keccak256(bytes(name));
        require(tokenIdByNameHash[nameHash] == 0, "name already claimed");

        uint256 next = _nextTokenId;
        uint256 price = baseMintPrice + (next - 1) * priceStep;
        require(price <= maxPrice, "price exceeds maxPrice");
        require(msg.value >= price, "insufficient payment");

        tokenId = next;
        _nextTokenId = next + 1;

        // Write all registry state BEFORE _safeMint so that a contract
        // recipient observes consistent metadata during onERC721Received.
        _nameByTokenId[tokenId] = name;
        tokenIdByNameHash[nameHash] = tokenId;

        bool autoSetPrimary = (primaryTokenOf[msg.sender] == 0);
        if (autoSetPrimary) {
            primaryTokenOf[msg.sender] = tokenId;
        }

        _safeMint(msg.sender, tokenId);

        emit UsernameClaimed(msg.sender, tokenId, name, price);
        if (autoSetPrimary) {
            emit PrimaryNameSet(msg.sender, tokenId, name);
        }

        uint256 refund = msg.value - price;
        if (refund > 0) {
            (bool sent, ) = payable(msg.sender).call{value: refund}("");
            require(sent, "refund failed");
        }
    }

    // ============================================
    // Primary name management
    // ============================================

    function setPrimaryName(uint256 tokenId) external {
        require(ownerOf(tokenId) == msg.sender, "not token owner");
        primaryTokenOf[msg.sender] = tokenId;
        emit PrimaryNameSet(msg.sender, tokenId, _nameByTokenId[tokenId]);
    }

    // ============================================
    // Transfer hook — primary-name bookkeeping
    // ============================================

    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        address from = super._update(to, tokenId, auth);

        // Skip primary bookkeeping on mint (from == address(0)).
        // Mint-time primary is handled in claim().
        if (from != address(0)) {
            // Clear sender's primary if this was their primary token
            if (primaryTokenOf[from] == tokenId) {
                primaryTokenOf[from] = 0;
            }
            // Auto-set recipient's primary if they have none
            if (to != address(0) && primaryTokenOf[to] == 0) {
                primaryTokenOf[to] = tokenId;
                emit PrimaryNameSet(to, tokenId, _nameByTokenId[tokenId]);
            }
        }

        return from;
    }

    // ============================================
    // Metadata
    // ============================================

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        string memory name = _nameByTokenId[tokenId];
        string memory json = string(abi.encodePacked(
            '{"name":"@', name,
            '","description":"Swarmit username: ', name, '"}'
        ));
        return string(abi.encodePacked("data:application/json;base64,", Base64.encode(bytes(json))));
    }

    // ============================================
    // Withdraw
    // ============================================

    function withdraw(address payable to) external onlyOwner nonReentrant {
        uint256 balance = address(this).balance;
        require(balance > 0, "nothing to withdraw");
        (bool sent, ) = to.call{value: balance}("");
        require(sent, "withdraw failed");
    }
}

/**
 * SwarmitUsernameRegistry ABI. Mirrors the public surface of
 * contracts/src/SwarmitUsernameRegistry.sol.
 *
 * When SwarmitUsernameRegistry.sol changes, update this file and encode.js,
 * bump the package version, and tag.
 */

export const ABI = [
  // --- events (2 custom + ERC721 Transfer) ---
  'event UsernameClaimed(address indexed owner, uint256 indexed tokenId, string name, uint256 pricePaid)',
  'event PrimaryNameSet(address indexed owner, uint256 indexed tokenId, string name)',
  'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)',

  // --- writes ---
  'function claim(string name, uint256 maxPrice) payable returns (uint256 tokenId)',
  'function setPrimaryName(uint256 tokenId)',

  // --- views ---
  'function currentMintPrice() view returns (uint256)',
  'function isAvailable(string name) view returns (bool)',
  'function primaryNameOf(address owner) view returns (string)',
  'function nameOfToken(uint256 tokenId) view returns (string)',
  'function primaryTokenOf(address) view returns (uint256)',
  'function tokenIdByNameHash(bytes32) view returns (uint256)',
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function tokenURI(uint256 tokenId) view returns (string)',
  'function baseMintPrice() view returns (uint256)',
  'function priceStep() view returns (uint256)',
];

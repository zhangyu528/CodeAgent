// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "CodexJSONLClient",
    platforms: [
        .macOS(.v13)
    ],
    products: [
        .executable(name: "CodexJSONLClient", targets: ["CodexJSONLClient"])
    ],
    targets: [
        .executableTarget(
            name: "CodexJSONLClient",
            path: "Sources/CodexJSONLClient"
        )
    ]
)

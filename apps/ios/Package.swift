// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "Refrain",
    platforms: [
        .iOS(.v17)
    ],
    products: [
        .library(
            name: "RefrainCore",
            targets: ["RefrainCore"]
        ),
    ],
    dependencies: [
        .package(url: "https://github.com/supabase/supabase-swift.git", from: "2.0.0"),
    ],
    targets: [
        .target(
            name: "RefrainCore",
            dependencies: [
                .product(name: "Supabase", package: "supabase-swift"),
            ],
            path: "Refrain",
            exclude: ["Resources"]
        ),
        .testTarget(
            name: "RefrainTests",
            dependencies: ["RefrainCore"],
            path: "RefrainTests"
        ),
    ]
)

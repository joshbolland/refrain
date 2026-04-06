import SwiftUI
import UIKit

/// App color and styling constants
enum Theme {
    // MARK: - Colors

    static let ink = Color(hex: "111827")
    static let muted = Color(hex: "374151")
    static let canvas = Color(hex: "FAFAF7")
    static let paper = Color(hex: "FFFFFF")
    static let panel = Color(hex: "EEF0FF")
    static let accent = Color(hex: "9DACFF")
    static let accentPressed = Color(hex: "7C8FFF")
    static let accentSoft = Color(hex: "EEF0FF")
    static let divider = Color(hex: "E3E5F0")
    static let headerBackground = Color(hex: "E8EBFF")
    static let headerTitle = Color(hex: "2B3550")
    static let headerSubtitle = Color(hex: "5E6B8C")
    static let destructive = Color(hex: "E71D36")
    static let placeholder = Color(hex: "9CA3AF")

    static let primaryColor = accent
    static let secondaryColor = muted
    static let backgroundColor = canvas
    static let secondaryBackgroundColor = paper
    static let tertiaryBackgroundColor = panel

    // Section type colors - aligned with React Native implementation
    static let sectionColors: [SectionType: (accent: Color, tint: Color)] = [
        .verse: (Color(hex: "9DACFF"), Color(hex: "EEF0FF")),
        .chorus: (Color(hex: "F4C95D"), Color(hex: "FFF4D6")),
        .bridge: (Color(hex: "4CC9B0"), Color(hex: "D9FBF4")),
        .preChorus: (Color(hex: "FF9F8A"), Color(hex: "FFE6E0")),
        .intro: (Color(hex: "65B9FF"), Color(hex: "E0F2FF")),
        .outro: (Color(hex: "B79BFF"), Color(hex: "F0E9FF")),
        .other: (Color(hex: "9CA3AF"), Color(hex: "F3F4F6"))
    ]

    /// Get the accent color for a section type
    static func sectionColor(for type: SectionType) -> Color {
        sectionColors[type]?.accent ?? accent
    }

    /// Get the tint (background) color for a section type
    static func sectionTintColor(for type: SectionType) -> Color {
        sectionColors[type]?.tint ?? accentSoft
    }

    // MARK: - Typography

    static let titleFont = Font.title2.weight(.semibold)
    static let headlineFont = Font.headline
    static let bodyFont = Font.body
    static let captionFont = Font.caption
    static let monospacedFont = Font.system(.body, design: .monospaced)

    // MARK: - Spacing

    static let paddingSmall: CGFloat = 8
    static let paddingMedium: CGFloat = 16
    static let paddingLarge: CGFloat = 24

    static let cornerRadiusSmall: CGFloat = 12
    static let cornerRadius: CGFloat = 18
    static let cornerRadiusLarge: CGFloat = 24
    static let cornerRadiusXL: CGFloat = 32

    // MARK: - Editor

    static let lineNumberWidth: CGFloat = 32
    static let sectionBadgeWidth: CGFloat = 32
    static let syllableCountWidth: CGFloat = 28

    // Aligned with React Native editorMetrics.ts
    static let editorLineHeight: CGFloat = 28
    static let editorFontSize: CGFloat = 15
    static let editorPaddingTop: CGFloat = 32
    static let editorHorizontalPadding: CGFloat = 16

    static func configureAppearance() {}
}

// MARK: - View Extensions

extension View {
    func cardStyle() -> some View {
        self
            .background(Theme.paper)
            .overlay(
                RoundedRectangle(cornerRadius: Theme.cornerRadius, style: .continuous)
                    .stroke(Theme.divider, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: Theme.cornerRadius, style: .continuous))
    }

    func primaryButtonStyle() -> some View {
        self
            .font(.system(size: 16, weight: .semibold))
            .foregroundStyle(.white)
            .padding(.horizontal, Theme.paddingMedium)
            .padding(.vertical, 12)
            .background(Theme.accent)
            .clipShape(RoundedRectangle(cornerRadius: Theme.cornerRadiusSmall, style: .continuous))
            .shadow(color: Color.black.opacity(0.08), radius: 12, x: 0, y: 8)
    }

    func secondaryButtonStyle() -> some View {
        self
            .font(.system(size: 16, weight: .semibold))
            .foregroundStyle(Theme.ink)
            .padding(.horizontal, Theme.paddingMedium)
            .padding(.vertical, 12)
            .background(Color.white.opacity(0.82))
            .overlay(
                RoundedRectangle(cornerRadius: Theme.cornerRadiusSmall, style: .continuous)
                    .stroke(Color.white.opacity(0.85), lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: Theme.cornerRadiusSmall, style: .continuous))
    }
}

extension Color {
    init(hex: String, alpha: Double = 1.0) {
        let cleaned = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var value: UInt64 = 0
        Scanner(string: cleaned).scanHexInt64(&value)

        let r = Double((value >> 16) & 0xFF) / 255.0
        let g = Double((value >> 8) & 0xFF) / 255.0
        let b = Double(value & 0xFF) / 255.0

        self.init(.sRGB, red: r, green: g, blue: b, opacity: alpha)
    }
}

extension UIColor {
    convenience init(hex: String, alpha: Double = 1.0) {
        let cleaned = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var value: UInt64 = 0
        Scanner(string: cleaned).scanHexInt64(&value)

        let r = CGFloat((value >> 16) & 0xFF) / 255.0
        let g = CGFloat((value >> 8) & 0xFF) / 255.0
        let b = CGFloat(value & 0xFF) / 255.0

        self.init(red: r, green: g, blue: b, alpha: alpha)
    }
}

struct PressableScaleStyle: ButtonStyle {
    var pressedOpacity: Double = 0.92
    var pressedOffset: CGFloat = 1

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .opacity(configuration.isPressed ? pressedOpacity : 1)
            .offset(y: configuration.isPressed ? pressedOffset : 0)
    }
}

struct RoundedCorner: Shape {
    var radius: CGFloat = .infinity
    var corners: UIRectCorner = .allCorners

    func path(in rect: CGRect) -> Path {
        let path = UIBezierPath(
            roundedRect: rect,
            byRoundingCorners: corners,
            cornerRadii: CGSize(width: radius, height: radius)
        )
        return Path(path.cgPath)
    }
}

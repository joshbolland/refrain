import SwiftUI

struct SearchBar: View {
    @Binding var text: String
    let placeholder: String

    @FocusState private var isFocused: Bool

    var body: some View {
        TextField(
            "",
            text: $text,
            prompt: Text(placeholder).foregroundStyle(Theme.placeholder)
        )
        .textFieldStyle(.plain)
        .focused($isFocused)
        .autocorrectionDisabled()
        .textInputAutocapitalization(.never)
        .tint(Theme.accent)
        .foregroundStyle(Theme.ink)
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .background(Theme.accentSoft)
        .clipShape(RoundedRectangle(cornerRadius: Theme.cornerRadiusSmall, style: .continuous))
    }
}

#Preview {
    VStack(spacing: 16) {
        SearchBar(text: .constant(""), placeholder: "Search ideas")
        SearchBar(text: .constant("Chorus"), placeholder: "Search ideas")
    }
    .padding()
    .background(Theme.canvas)
}

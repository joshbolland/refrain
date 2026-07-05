import SwiftUI

private let projectsCardHeight: CGFloat = 120

struct ProjectsView: View {
    @Environment(AppState.self) private var appState

    let onCreate: () -> Void

    @State private var showNewProjectSheet = false
    @State private var showProfile = false
    @State private var selectedProject: Project?
    @State private var searchQuery = ""

    init(onCreate: @escaping () -> Void = {}) {
        self.onCreate = onCreate
    }

    private let columns = [
        GridItem(.flexible(), spacing: 12),
        GridItem(.flexible(), spacing: 12)
    ]

    private var trimmedSearchQuery: String {
        searchQuery.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private var filteredProjects: [Project] {
        guard !trimmedSearchQuery.isEmpty else {
            return appState.projects
        }

        return appState.projects.filter { project in
            project.title.localizedCaseInsensitiveContains(trimmedSearchQuery) ||
            (project.description?.localizedCaseInsensitiveContains(trimmedSearchQuery) ?? false)
        }
    }

    private var headerSubtitle: String {
        if !trimmedSearchQuery.isEmpty {
            let resultCount = filteredProjects.count
            let resultLabel = resultCount == 1 ? "project" : "projects"
            return "Showing \(resultCount) \(resultLabel) for \"\(trimmedSearchQuery)\""
        }

        let projectCount = appState.projects.count
        if projectCount == 0 {
            return "Group lyrics and recordings for quick access."
        }

        let totalItems = appState.projects.reduce(0) { total, project in
            let counts = appState.itemCount(for: project)
            return total + counts.total
        }

        let projectLabel = projectCount == 1 ? "project" : "projects"
        let itemLabel = totalItems == 1 ? "item" : "items"
        return "\(projectCount) \(projectLabel) • \(totalItems) \(itemLabel)"
    }

    var body: some View {
        NavigationStack {
            ZStack(alignment: .top) {
                Theme.headerBackground
                    .ignoresSafeArea()

                VStack(spacing: 0) {
                    headerView()

                    VStack(spacing: 0) {
                        if !appState.projects.isEmpty {
                            SearchBar(text: $searchQuery, placeholder: "Search projects")
                                .padding(.top, 22)
                                .padding(.horizontal, 20)
                                .padding(.bottom, 16)
                        }

                        ScrollView {
                            VStack(spacing: 16) {
                                if appState.projects.isEmpty {
                                    createProjectCard
                                } else if filteredProjects.isEmpty {
                                    noSearchResultsCard
                                } else {
                                    LazyVGrid(columns: columns, spacing: 12) {
                                        createProjectCard

                                        ForEach(filteredProjects) { project in
                                            ProjectCard(
                                                project: project,
                                                counts: appState.itemCount(for: project),
                                                previewItems: Array(appState.itemsInProject(project).prefix(3))
                                            )
                                            .onTapGesture {
                                                selectedProject = project
                                            }
                                            .contextMenu {
                                                Button {
                                                    selectedProject = project
                                                } label: {
                                                    Label("Open", systemImage: "folder")
                                                }

                                                Button(role: .destructive) {
                                                    Task {
                                                        await appState.deleteProject(project)
                                                    }
                                                } label: {
                                                    Label("Delete", systemImage: "trash")
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                            .padding(.top, appState.projects.isEmpty ? 20 : 0)
                            .padding(.horizontal, 20)
                            .padding(.bottom, 120)
                            .frame(maxWidth: .infinity)
                        }
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(Theme.canvas)
                    .clipShape(
                        RoundedCorner(
                            radius: Theme.cornerRadiusSmall,
                            corners: [.topLeft, .topRight]
                        )
                    )
                    .shadow(color: Color.black.opacity(0.06), radius: 12, x: 0, y: 6)
                }
            }
            .overlay(alignment: .bottom) {
                PrimaryTabBarContainer(onCreate: onCreate)
            }
            .ignoresSafeArea(.keyboard, edges: .bottom)
            .toolbar(.hidden, for: .navigationBar)
            .sheet(isPresented: $showNewProjectSheet) {
                NewProjectSheet()
            }
            .sheet(isPresented: $showProfile) {
                ProfileView()
            }
            .navigationDestination(item: $selectedProject) { project in
                ProjectDetailView(project: project)
            }
        }
    }

    private func headerView() -> some View {
        HStack(alignment: .center, spacing: 12) {
            VStack(alignment: .leading, spacing: 6) {
                Text("Projects")
                    .font(.system(size: 30, weight: .semibold))
                    .foregroundStyle(Theme.headerTitle)

                Text(headerSubtitle)
                    .font(.system(size: 14))
                    .foregroundStyle(Theme.headerSubtitle)
            }

            Spacer()

            Button {
                showProfile = true
            } label: {
                UserAvatar(user: appState.currentUser)
            }
            .buttonStyle(PressableScaleStyle())
        }
        .padding(.top, 6)
        .padding(.horizontal, 20)
        .padding(.bottom, 28)
    }

    private var createProjectCard: some View {
        Button {
            showNewProjectSheet = true
        } label: {
            VStack(alignment: .leading, spacing: 8) {
                Text("+")
                    .font(.system(size: 20, weight: .bold))
                    .foregroundStyle(Theme.accent)
                    .frame(width: 40, height: 40)
                    .background(Theme.paper)
                    .overlay(
                        RoundedRectangle(cornerRadius: 12, style: .continuous)
                            .stroke(Color(hex: "D7DDFF"), lineWidth: 1)
                    )
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))

                Text("Create project")
                    .font(.system(size: 17, weight: .semibold))
                    .foregroundStyle(Theme.accent)

                Text("Group lyrics or recordings.")
                    .font(.system(size: 14))
                    .foregroundStyle(Theme.muted.opacity(0.8))
            }
            .frame(maxWidth: .infinity, minHeight: projectsCardHeight, alignment: .topLeading)
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
            .background(
                LinearGradient(
                    colors: [Color(hex: "EEF1FF"), Color(hex: "E7EBFF")],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
            )
            .overlay(
                RoundedRectangle(cornerRadius: Theme.cornerRadius, style: .continuous)
                    .stroke(Color(hex: "D7DDFF"), lineWidth: 2)
            )
            .shadow(color: Color.black.opacity(0.04), radius: 10, x: 0, y: 5)
            .clipShape(RoundedRectangle(cornerRadius: Theme.cornerRadius, style: .continuous))
        }
        .buttonStyle(PressableScaleStyle())
    }

    private var noSearchResultsCard: some View {
        VStack(spacing: 10) {
            Text("No matching projects")
                .font(.system(size: 18, weight: .semibold))
                .foregroundStyle(Theme.ink)

            Text("Try a different title or clear your search.")
                .font(.system(size: 14))
                .foregroundStyle(Theme.muted.opacity(0.85))
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 28)
        .padding(.horizontal, 18)
        .background(Theme.accentSoft)
        .clipShape(RoundedRectangle(cornerRadius: Theme.cornerRadius, style: .continuous))
    }
}

struct ProjectCard: View {
    let project: Project
    let counts: (total: Int, lyrics: Int, recordings: Int)
    let previewItems: [LibraryItem]

    var body: some View {
        let countLabel = counts.total == 1 ? "1 item" : "\(counts.total) items"

        return VStack(alignment: .leading, spacing: 10) {
            Text(project.title.isEmpty ? "Untitled project" : project.title)
                .font(.system(size: 17, weight: .semibold))
                .foregroundStyle(Theme.ink)
                .lineLimit(2)

            if previewItems.isEmpty {
                Text("No items yet")
                    .font(.system(size: 14))
                    .foregroundStyle(Theme.muted.opacity(0.8))
                    .lineLimit(1)
            } else {
                VStack(alignment: .leading, spacing: 6) {
                    ForEach(previewItems, id: \.id) { item in
                        HStack(spacing: 8) {
                            Image(systemName: item.isLyric ? "music.note" : "waveform")
                                .font(.system(size: 11, weight: .semibold))
                                .foregroundStyle(Theme.accentPressed)
                                .frame(width: 12)

                            Text(item.title.isEmpty ? "Untitled" : item.title)
                                .font(.system(size: 13))
                                .foregroundStyle(Theme.muted.opacity(0.9))
                                .lineLimit(1)
                        }
                    }

                    if counts.total > previewItems.count {
                        Text("+\(counts.total - previewItems.count) more")
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundStyle(Theme.muted.opacity(0.72))
                            .lineLimit(1)
                    }
                }
            }

            Spacer(minLength: 0)

            Text(countLabel)
                .font(.system(size: 12, weight: .semibold))
                .textCase(.uppercase)
                .tracking(0.8)
                .foregroundStyle(Theme.muted.opacity(0.75))
        }
        .frame(maxWidth: .infinity, minHeight: projectsCardHeight, alignment: .topLeading)
        .padding(.horizontal, 16)
        .padding(.top, 18)
        .padding(.bottom, 12)
        .background(Color(hex: "FCFCFF"))
        .overlay(
            RoundedRectangle(cornerRadius: Theme.cornerRadius, style: .continuous)
                .stroke(Color(hex: "E0E4F2"), lineWidth: 1)
        )
        .shadow(color: Color.black.opacity(0.035), radius: 10, x: 0, y: 5)
        .clipShape(RoundedRectangle(cornerRadius: Theme.cornerRadius, style: .continuous))
    }
}

#Preview("Projects Populated") {
    ProjectsView()
        .environment(AppState.preview())
        .environment(\.isPreview, true)
}

#Preview("Projects Empty") {
    ProjectsView()
        .environment(AppState.preview(populated: false))
        .environment(\.isPreview, true)
}

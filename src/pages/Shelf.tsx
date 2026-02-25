import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useStories, Story, StoryPage } from "@/hooks/useStories";
import { StoryCard } from "@/components/StoryCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Sparkles, Plus, Search, LogOut, Loader2, BookOpen, RefreshCw, WifiOff, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const Shelf = () => {
  const navigate = useNavigate();
  const { user, signOut, loading: authLoading } = useAuth();
  const { stories, communityStories, loading: storiesLoading, error: storiesError, deleteStory, getStoryWithPages, retryFetch } = useStories();
  const [searchQuery, setSearchQuery] = useState("");
  const [pageCounts, setPageCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    const fetchPageCounts = async () => {
      const allStories = [...stories, ...communityStories];
      if (allStories.length === 0) return;
      
      const counts: Record<string, number> = {};
      for (const story of allStories) {
        const { data } = await supabase
          .from("story_pages")
          .select("id", { count: "exact" })
          .eq("story_id", story.id);
        counts[story.id] = data?.length || 0;
      }
      setPageCounts(counts);
    };
    
    fetchPageCounts();
  }, [stories, communityStories]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  const handleCreateNew = () => {
    localStorage.removeItem("story-draft");
    navigate("/?new=true");
  };

  const handleOpenStory = (id: string) => {
    navigate(`/?story=${id}`);
  };

  const handleDeleteStory = async (id: string) => {
    await deleteStory(id);
  };

  const handleDownloadStory = async (id: string) => {
    const result = await getStoryWithPages(id);
    if (!result) return;

    const { story, pages } = result;
    const pagesWithImages = pages.filter((p: StoryPage) => p.image_url);

    if (pagesWithImages.length === 0) {
      toast.error("No pages with images to download");
      return;
    }

    const loadingToast = toast.loading(`Preparing ${pagesWithImages.length} pages...`);

    try {
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();

      for (const page of pagesWithImages) {
        if (page.image_url) {
          const response = await fetch(page.image_url);
          const blob = await response.blob();
          zip.file(`${story.title}-page-${page.page_number}.png`, blob);
        }
      }

      const content = await zip.generateAsync({ type: "blob" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(content);
      link.download = `${story.title}-${Date.now()}.zip`;
      link.click();
      URL.revokeObjectURL(link.href);

      toast.dismiss(loadingToast);
      toast.success(`Downloaded ${pagesWithImages.length} pages!`);
    } catch (error) {
      toast.dismiss(loadingToast);
      toast.error("Failed to download story");
    }
  };

  const filteredStories = stories.filter((story) =>
    story.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredCommunityStories = communityStories.filter((story) =>
    story.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const renderStoryGrid = (storyList: Story[], hideDelete = false) => {
    if (storyList.length === 0) {
      return (
        <div className="text-center py-16 space-y-4">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto">
            <BookOpen className="w-8 h-8 text-muted-foreground" />
          </div>
          <div>
            <h3 className="text-lg font-medium text-foreground">
              {searchQuery ? "No stories found" : hideDelete ? "No community stories yet" : "No stories yet"}
            </h3>
            <p className="text-muted-foreground mt-1">
              {searchQuery
                ? "Try a different search term"
                : hideDelete
                  ? "Stories created by others will appear here"
                  : "Create your first story to get started"
              }
            </p>
          </div>
          {!searchQuery && !hideDelete && (
            <Button onClick={handleCreateNew}>
              <Plus className="w-4 h-4 mr-2" />
              Create Story
            </Button>
          )}
        </div>
      );
    }

    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {storyList.map((story) => (
          <StoryCard
            key={story.id}
            id={story.id}
            title={story.title}
            coverImageUrl={story.cover_image_url}
            updatedAt={story.updated_at}
            pageCount={pageCounts[story.id] || 0}
            hideDelete={hideDelete}
            onOpen={handleOpenStory}
            onDelete={handleDeleteStory}
            onDownload={handleDownloadStory}
          />
        ))}
      </div>
    );
  };

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary to-accent-foreground flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground">My Story Shelf</h1>
              <p className="text-xs text-muted-foreground">{user?.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={handleCreateNew}>
              <Plus className="w-4 h-4 mr-2" />
              New Story
            </Button>
            <Button variant="outline" size="icon" onClick={handleSignOut}>
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 space-y-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search stories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {storiesLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : storiesError ? (
          <div className="text-center py-16 space-y-4">
            <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
              <WifiOff className="w-8 h-8 text-destructive" />
            </div>
            <div>
              <h3 className="text-lg font-medium text-foreground">Connection Error</h3>
              <p className="text-muted-foreground mt-1">{storiesError}</p>
            </div>
            <Button onClick={retryFetch} variant="outline">
              <RefreshCw className="w-4 h-4 mr-2" />
              Try Again
            </Button>
          </div>
        ) : (
          <Tabs defaultValue="my-stories">
            <TabsList>
              <TabsTrigger value="my-stories">
                <BookOpen className="w-4 h-4 mr-2" />
                My Stories ({filteredStories.length})
              </TabsTrigger>
              <TabsTrigger value="community">
                <Users className="w-4 h-4 mr-2" />
                Community ({filteredCommunityStories.length})
              </TabsTrigger>
            </TabsList>
            <TabsContent value="my-stories">
              {renderStoryGrid(filteredStories)}
            </TabsContent>
            <TabsContent value="community">
              {renderStoryGrid(filteredCommunityStories, true)}
            </TabsContent>
          </Tabs>
        )}
      </div>
    </main>
  );
};

export default Shelf;

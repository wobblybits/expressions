import { Component } from 'solid-js';
import PageLayout from '../components/ui/PageLayout';
import MoviePage from '../pages/MoviePage';

const Movie: Component = () => {
  return (
    <PageLayout 
      title="Emotional Expression Movie" 
      description="Real-time emotion detection using your movie"
    >
        <MoviePage />
    </PageLayout>
  );
};

export default Movie;
